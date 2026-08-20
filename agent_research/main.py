import os
import sys
import json
from dotenv import load_dotenv
from openai import OpenAI

from tools import TOOL_SCHEMAS, TOOL_DISPATCH, get_chroma_client
from pdf_generator import generate_pdf

# Load env variables (assumes .env.local or .env exists in current or parent directory)
load_dotenv('.env.local')
load_dotenv('.env')
load_dotenv()

# System prompt forcing structured JSON output and rigorous research steps
SYSTEM_PROMPT = """You are a Senior autonomous financial research agent. Your task is to research a given stock/topic and provide a final JSON report.
Follow the ReAct loop (Reason, Act, Observe). You have tools available. USE THEM.

STEPS:
1. Search ChromaDB memory for past context using `search_memory`.
2. Extract macroeconomic state using `get_macro_data`.
3. Fetch SEC filings and Live Prices (`download_sec_filings`, `get_live_price`).
4. Perform deep web research (`search_web`).
5. Use Math (`execute_math`) to calculate a Conviction Score (1-100) based on your formula.

YOUR FINAL OUTPUT MUST BE IN PURE JSON (no markdown wrapping) WITH THIS EXACT STRUCTURE:
{
  "ticker": "<TICKER>",
  "conviction_score": <NUMBER 1-100>,
  "executive_summary": ["Bullet 1", "Bullet 2", "Bullet 3"],
  "price_and_macro_context": "<String context>",
  "company_profile": "<Long deep dive text>",
  "sec_filing_risks": "<String>",
  "recent_news": "<String>",
  "sector_breakdown": "<String>"
}
"""

def main(ticker: str):
    print(f"Starting generic research agent process for {ticker}...")
    
    api_key = os.getenv("OPENROUTER_API_KEY", os.getenv("OPENAI_API_KEY", ""))
    if not api_key:
        print("Error: OPENROUTER_API_KEY is not set in environment or .env files.")
        sys.exit(1)

    # Configure OpenAI Client (pointing to OpenRouter as requested)
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key
    )
    
    model = os.getenv("OPENROUTER_RESEARCH_MODEL", "openai/gpt-4o-mini")

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Please generate a complete financial research report for: {ticker}."}
    ]

    max_steps = 15
    step_count = 0
    final_json = None

    while step_count < max_steps:
        step_count += 1
        print(f"--- ReAct Step {step_count} ---")
        
        # 1. Ask LLM to reason or call tool
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                tools=TOOL_SCHEMAS,
                tool_choice="auto",
                temperature=0.2
            )
        except Exception as e:
            print(f"LLM API Error: {str(e)}")
            sys.exit(1)

        message = response.choices[0].message
        
        # If the model called a tool
        if message.tool_calls:
            # We must append the assistant's message with the tool calls
            messages.append(message)
            
            for tool_call in message.tool_calls:
                tool_name = tool_call.function.name
                tool_args = json.loads(tool_call.function.arguments)
                print(f"-> Calling tool: {tool_name}({tool_args})")
                
                # Execute the tool
                if tool_name in TOOL_DISPATCH:
                    tool_result = TOOL_DISPATCH[tool_name](**tool_args)
                else:
                    tool_result = f"Error: Tool {tool_name} not found."
                    
                # Append tool result to messages
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": str(tool_result)
                })
        else:
            # The model returned text (hopefully our final JSON)
            print("-> LLM returned final text without tool calls.")
            raw_text = message.content.strip()
            # Try to strip markdown JSON block
            if raw_text.startswith("```json"):
                raw_text = raw_text.replace("```json", "", 1)
                if raw_text.endswith("```"):
                    raw_text = raw_text[:-3]
            raw_text = raw_text.strip()
            
            try:
                final_json = json.loads(raw_text)
                break
            except json.JSONDecodeError:
                print("Failed to decode JSON. Retrying by enforcing JSON.")
                messages.append({"role": "assistant", "content": message.content})
                messages.append({"role": "user", "content": "Your previous output was not valid JSON. Please return strictly valid JSON matching the schema."})

    if not final_json:
        print("Agent failed to produce the final structured JSON within steps limit.")
        sys.exit(1)

    print("Successfully generated Structured Data. Committing to memory and generating PDF...")
    
    # Commit to ChromaDB memory
    chroma_client = get_chroma_client()
    collection = chroma_client.get_or_create_collection("research_memory")
    doc_id = f"{ticker}_report_{step_count}"
    # Upsert the JSON as memory
    collection.upsert(
        documents=[json.dumps(final_json)],
        metadatas=[{"ticker": ticker}],
        ids=[doc_id]
    )

    # Generate PDF
    pdf_filename = f"research_report_{ticker}.pdf"
    pdf_path = generate_pdf(final_json, pdf_filename)
    
    # We output the absolute path so the node backend can grab it
    print(f"FINAL_PDF_PATH:{os.path.abspath(pdf_path)}")
    print("Done.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python main.py <TICKER>")
        sys.exit(1)
    
    target_ticker = sys.argv[1].upper()
    main(target_ticker)
