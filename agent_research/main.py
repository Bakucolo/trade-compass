import os
import sys
import json
import sqlite3
from datetime import datetime
from dotenv import load_dotenv
from openai import OpenAI

from tools import TOOL_SCHEMAS, TOOL_DISPATCH, get_live_price, get_macro_data
from pdf_generator import generate_pdf

# Load env variables (.env.local, .env)
load_dotenv('.env.local')
load_dotenv('.env')
load_dotenv()

# Built-in Default Prompts
DEFAULT_PROMPTS = {
    "company_research": {
        "title": "Company In-Depth Research Report",
        "system": """You are an elite Wall Street Equity Research Analyst. Your task is to perform an exhaustive, high-conviction fundamental research report for the given ticker.
Follow the ReAct loop (Reason, Act, Observe). Use available tools to gather real-time data, macro context, SEC filings, and news.

YOUR FINAL OUTPUT MUST BE IN PURE JSON (no markdown fences outside JSON) WITH THIS EXACT STRUCTURE:
{
  "ticker": "<TICKER>",
  "report_title": "Company In-Depth Research Report: <TICKER>",
  "conviction_score": <NUMBER 1-100>,
  "executive_summary": ["Key thesis point 1", "Key thesis point 2", "Key thesis point 3", "Key valuation target"],
  "business_model_and_moat": "<Detailed analysis of core business lines, revenue drivers, pricing power, and competitive moat>",
  "financial_and_valuation_analysis": "<Deep dive into margins, revenue growth, ROE, debt health, and multiple comparison>",
  "sec_filings_and_risk_factors": "<Key risks and red flags identified from 10-K/10-Q filings>",
  "macro_and_industry_tailwinds": "<Industry trends, macro environment, interest rates, and regulatory factors>",
  "catalysts_and_price_target": "<Next 12-month catalysts, earnings expectations, and strategic price target recommendation>"
}
"""
    },
    "management": {
        "title": "Executive Leadership & Governance Report",
        "system": """You are an activist investor and governance analyst. Your task is to evaluate the executive leadership, capital allocation track record, insider ownership, and corporate governance for the given ticker.
Follow the ReAct loop. Use your tools to gather company leadership info, SEC insider filings, executive compensation, and strategic capital allocation history.

YOUR FINAL OUTPUT MUST BE IN PURE JSON (no markdown fences outside JSON) WITH THIS EXACT STRUCTURE:
{
  "ticker": "<TICKER>",
  "report_title": "Executive Leadership & Governance Report: <TICKER>",
  "conviction_score": <NUMBER 1-100>,
  "executive_summary": ["Leadership assessment 1", "Capital allocation rating 2", "Governance risk 3"],
  "executive_leadership_profiles": "<Assessment of CEO, CFO, and key management background, tenure, and strategic vision>",
  "capital_allocation_track_record": "<Analysis of ROIC, R&D reinvestment, M&A history, share repurchases, and dividend safety>",
  "insider_ownership_and_alignment": "<Insider ownership stakes, recent insider buy/sell transactions, and incentive alignment>",
  "governance_and_board_oversight": "<Board independence, shareholder rights, executive compensation structure, and controversies>",
  "leadership_verdict": "<Final conviction on management's ability to create long-term shareholder value>"
}
"""
    },
    "earnings": {
        "title": "Latest Earnings & Quarterly Performance Report",
        "system": """You are a senior hedge fund analyst analyzing the most recent quarterly earnings results and forward guidance for the given ticker.
Follow the ReAct loop. Use your tools to inspect latest earnings release, revenue/EPS beats or misses, segment breakdown, management guidance, and conference call takeaways.

YOUR FINAL OUTPUT MUST BE IN PURE JSON (no markdown fences outside JSON) WITH THIS EXACT STRUCTURE:
{
  "ticker": "<TICKER>",
  "report_title": "Quarterly Earnings & Guidance Report: <TICKER>",
  "conviction_score": <NUMBER 1-100>,
  "executive_summary": ["Quarterly headline result", "Guidance update", "Market reaction driver", "Revised target stance"],
  "quarterly_financial_results": "<Revenue, EPS, gross margins, and operating income vs consensus expectations>",
  "segment_and_regional_breakdown": "<Performance across major business units, product lines, and geographical markets>",
  "management_guidance_and_outlook": "<Next quarter and full-year outlook, capex expectations, and revised targets>",
  "earnings_call_takeaways": "<Key commentary from CEO/CFO, tone on demand, supply chain, and competitive pressures>",
  "earnings_reaction_and_target": "<Post-earnings valuation impact and revised investment stance>"
}
"""
    },
    "red_flags_and_risks": {
        "title": "Forensic Red Flags, Warnings & Risk Audit",
        "system": """You are a legendary forensic financial auditor and short-seller risk analyst. Your objective is to perform a rigorous, unsparing investigation into all red flags, accounting warnings, hidden balance sheet hazards, regulatory/litigation perils, and structural downside risks for the given ticker.
Follow the ReAct loop. Use available tools to search SEC 10-K/10-Q risk factors, debt maturity schedules, auditor opinions, insider sales, customer/supplier concentration, margin pressure, and short seller commentary.

YOUR FINAL OUTPUT MUST BE IN PURE JSON (no markdown fences outside JSON) WITH THIS EXACT STRUCTURE:
{
  "ticker": "<TICKER>",
  "report_title": "Forensic Red Flags, Warnings & Risk Audit: <TICKER>",
  "conviction_score": <NUMBER 1-100 where higher represents critical risk severity / danger>,
  "executive_summary": [
    "🚨 Critical Warning / Red Flag 1",
    "⚠️ Solvency / Liquidity Hazard 2",
    "📉 Competitive / Margin Risk 3",
    "⚖️ Regulatory / Governance Warning 4"
  ],
  "critical_red_flags_and_warnings": "<Exhaustive forensic breakdown of active red flags: revenue recognition issues, divergence between net income and operating cash flow, inventory build-up, accounts receivable aging, auditor footnotes, or unusual one-off adjustments>",
  "balance_sheet_debt_and_solvency_risks": "<Deep solvency audit: Total debt vs EBITDA, interest coverage ratio, upcoming debt maturities in 1-3 years, liquidity runway, working capital trends, and risk of dilutive secondary offerings or covenant breaches>",
  "operational_margin_and_competitive_threats": "<Operational risk factors: Customer or supplier concentration (>10% revenue from single client), pricing power erosion, input cost inflation, technological obsolescence, or aggressive market share loss to competitors>",
  "regulatory_legal_and_governance_risks": "<Legal, regulatory, and governance red flags: Ongoing SEC/FTC/DOJ investigations, antitrust actions, patent cliffs, aggressive insider selling clusters, dual-class voting structures, or related-party transactions>",
  "bear_case_thesis_and_downside_target": "<The ultimate Bear Case scenario: What specific catalyst could trigger a severe 30-60% repricing, estimate of intrinsic liquidation or distressed value, and downside price target range>"
}
"""
    }
}

def load_prompt_from_db(slug_or_id: str):
    """Fetches custom or default prompt template directly from tradeflow.db SQLite database."""
    if not slug_or_id:
        return None, None
    try:
        candidate_paths = [
            os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "prisma", "tradeflow.db"),
            os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tradeflow.db"),
            os.path.join(os.getcwd(), "prisma", "tradeflow.db"),
            os.path.join(os.getcwd(), "tradeflow.db"),
            "prisma/tradeflow.db",
            "tradeflow.db",
            "../tradeflow.db"
        ]
        db_path = next((p for p in candidate_paths if os.path.exists(p)), None)
        if db_path:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT systemPrompt, name FROM ReportPromptTemplate WHERE id = ? OR slug = ? LIMIT 1", (slug_or_id, slug_or_id))
            row = cursor.fetchone()
            conn.close()
            if row and row[0]:
                return row[0].strip(), row[1].strip()
    except Exception as e:
        print(f"Notice: SQLite prompt lookup error: {e}")
    return None, None

def clean_json_string(text: str) -> str:
    """Strips markdown codeblocks and extracts valid JSON substring."""
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned.replace("```json", "", 1)
    elif cleaned.startswith("```"):
        cleaned = cleaned.replace("```", "", 1)
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    # If extra text precedes or follows JSON, slice between first { and last }
    first_brace = cleaned.find("{")
    last_brace = cleaned.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        cleaned = cleaned[first_brace:last_brace + 1]

    return cleaned

def main(ticker: str, report_type: str = "company_research", prompt_id_or_custom: str = None):
    print(f"Starting research process for {ticker} [Type: {report_type}]...")

    openrouter_key = os.getenv("OPENROUTER_API_KEY", os.getenv("OPENAI_API_KEY", "")).strip()
    gemini_key = os.getenv("GEMINI_API_KEY", os.getenv("GOOGLE_API_KEY", "")).strip()

    # Prioritize OpenRouter if available (reliable, higher limits) or fallback to Gemini
    if openrouter_key:
        print("Using OpenRouter API (gpt-4o-mini)...")
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=openrouter_key
        )
        model = os.getenv("OPENROUTER_RESEARCH_MODEL", "openai/gpt-4o-mini")
        provider = "openrouter"
    elif gemini_key:
        print("Using Google AI Studio (Gemini) API...")
        client = OpenAI(
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            api_key=gemini_key
        )
        model = os.getenv("GEMINI_RESEARCH_MODEL", "gemini-2.0-flash")
        provider = "gemini"
    else:
        print("Error: No API key found. Please set OPENROUTER_API_KEY or GEMINI_API_KEY in .env.local")
        sys.exit(1)

    # Select Prompt
    system_prompt = None
    report_title = None

    if prompt_id_or_custom:
        db_prompt, db_title = load_prompt_from_db(prompt_id_or_custom)
        if db_prompt:
            system_prompt = db_prompt
            report_title = f"{db_title}: {ticker}"
        elif len(prompt_id_or_custom) > 50:
            system_prompt = prompt_id_or_custom.strip()
            report_title = f"{ticker} Custom Research Report"

    if not system_prompt and report_type:
        db_prompt, db_title = load_prompt_from_db(report_type)
        if db_prompt:
            system_prompt = db_prompt
            report_title = f"{db_title}: {ticker}"

    if not system_prompt:
        if report_type in DEFAULT_PROMPTS:
            system_prompt = DEFAULT_PROMPTS[report_type]["system"]
            report_title = f"{DEFAULT_PROMPTS[report_type]['title']}: {ticker}"
        else:
            system_prompt = DEFAULT_PROMPTS["company_research"]["system"]
            report_title = f"Company In-Depth Research Report: {ticker}"

    # Pre-fetch live price and macro data to ground the model immediately
    live_price_data = get_live_price(ticker)
    macro_data = get_macro_data()

    initial_user_message = f"""Please generate a complete, rigorous research report for symbol: {ticker} (Date: {datetime.now().strftime('%B %d, %Y')}).

Initial Live Market Context:
- Live Price & Metrics: {live_price_data}
- Macro Context: {macro_data}

Conduct any additional necessary web searches or filings reviews, and then provide your complete research report in the required strict JSON schema."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": initial_user_message}
    ]

    max_steps = 8
    step_count = 0
    total_tool_calls = 0
    final_json = None

    while step_count < max_steps:
        step_count += 1
        print(f"--- ReAct Step {step_count} ---")

        # After 2-3 tool iterations, instruct the model to finalize the report in JSON
        force_finalize = (step_count >= 4 or total_tool_calls >= 4)
        tool_choice = "none" if force_finalize else "auto"

        if force_finalize:
            messages.append({
                "role": "user",
                "content": "You now have all necessary research data. Synthesize your final conclusions and output ONLY the complete JSON object adhering strictly to the required schema."
            })

        response = None
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                tools=None if force_finalize else TOOL_SCHEMAS,
                tool_choice=tool_choice if not force_finalize else None,
                temperature=0.2
            )
        except Exception as err:
            print(f"Primary provider error with {model}: {err}")
            # If Gemini failed with 429 and OpenRouter key is available, switch to OpenRouter
            if provider == "gemini" and openrouter_key:
                print("Switching permanently to OpenRouter (openai/gpt-4o-mini)...")
                client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=openrouter_key)
                model = "openai/gpt-4o-mini"
                provider = "openrouter"
                try:
                    response = client.chat.completions.create(
                        model=model,
                        messages=messages,
                        tools=None if force_finalize else TOOL_SCHEMAS,
                        tool_choice=tool_choice if not force_finalize else None,
                        temperature=0.2
                    )
                except Exception as or_err:
                    print(f"OpenRouter fallback error: {or_err}")
            elif provider == "openrouter" and gemini_key:
                print("Switching to Gemini fallback...")
                client = OpenAI(base_url="https://generativelanguage.googleapis.com/v1beta/openai/", api_key=gemini_key)
                model = "gemini-2.0-flash"
                provider = "gemini"
                try:
                    response = client.chat.completions.create(
                        model=model,
                        messages=messages,
                        tools=None if force_finalize else TOOL_SCHEMAS,
                        temperature=0.2
                    )
                except Exception as gem_err:
                    print(f"Gemini fallback error: {gem_err}")

        if not response:
            print("Failed to get response from any LLM provider. Exiting.")
            sys.exit(1)

        message = response.choices[0].message

        # Tool calls handling
        if message.tool_calls and not force_finalize:
            messages.append(message)
            total_tool_calls += len(message.tool_calls)

            for tool_call in message.tool_calls:
                tool_name = tool_call.function.name
                try:
                    tool_args = json.loads(tool_call.function.arguments)
                except Exception:
                    tool_args = {}
                print(f"-> Calling tool: {tool_name}({tool_args})")

                if tool_name in TOOL_DISPATCH:
                    try:
                        tool_result = TOOL_DISPATCH[tool_name](**tool_args)
                    except Exception as err:
                        tool_result = f"Error executing {tool_name}: {err}"
                else:
                    tool_result = f"Error: Tool {tool_name} not found."

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": str(tool_result)[:3000] # Cap output size to prevent token blowout
                })
        else:
            # Model returned text
            raw_text = message.content or ""
            print(f"-> LLM returned text (length: {len(raw_text)}). Parsing JSON...")
            cleaned = clean_json_string(raw_text)

            try:
                final_json = json.loads(cleaned)
                break
            except json.JSONDecodeError as decode_err:
                print(f"JSON decode failed ({decode_err}). Requesting correction...")
                messages.append({"role": "assistant", "content": raw_text})
                messages.append({
                    "role": "user",
                    "content": "Your previous response was not valid JSON. Please re-format your response as pure, valid JSON with no markdown wrapping or preamble."
                })

    if not final_json:
        print("Agent failed to produce the final structured JSON within steps limit.")
        sys.exit(1)

    print("Successfully generated Structured Data. Generating PDF...")
    final_json["ticker"] = ticker
    if "report_title" not in final_json:
        final_json["report_title"] = report_title
    final_json["date"] = datetime.now().strftime("%B %d, %Y")

    # Generate PDF
    pdf_filename = f"research_report_{ticker}_{report_type}.pdf"
    pdf_path = generate_pdf(final_json, pdf_filename)
    abs_pdf_path = os.path.abspath(pdf_path)


    print(f"FINAL_REPORT_JSON:{json.dumps(final_json)}")
    print(f"FINAL_PDF_PATH:{abs_pdf_path}")
    print("Done.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python main.py <TICKER> [REPORT_TYPE] [CUSTOM_SYSTEM_PROMPT]")
        sys.exit(1)

    target_ticker = sys.argv[1].upper()
    target_report_type = sys.argv[2] if len(sys.argv) > 2 else "company_research"
    target_custom_prompt = sys.argv[3] if len(sys.argv) > 3 else None

    main(target_ticker, target_report_type, target_custom_prompt)
