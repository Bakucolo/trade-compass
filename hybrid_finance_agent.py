from __future__ import annotations

import os
import sys
import json
import math
from typing import Annotated, Literal, Sequence, TypedDict, Any, Optional

# Ensure Windows terminal handles UTF-8 characters (e.g. financial math symbols, arrows, currencies)
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from dotenv import load_dotenv
from pydantic import BaseModel, Field

import numpy as np
import scipy.stats as stats
import yfinance as yf
from tavily import TavilyClient

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage
from langchain_core.tools import tool
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

# -----------------------------------------------------------------------------
# 1. Configuration & API Keys
# -----------------------------------------------------------------------------
# Automatically load environment variables from .env.local or .env
load_dotenv(".env.local")
load_dotenv(".env")

# =============================================================================
# >>> INSERT YOUR API KEYS BELOW (OR SET THEM IN .env / .env.local) <<<
# =============================================================================
OPENROUTER_API_KEY = os.getenv(
    "OPENROUTER_API_KEY",
    "YOUR_OPENROUTER_API_KEY_HERE"  # <-- [INSERT YOUR OPENROUTER API KEY HERE]
)

TAVILY_API_KEY = os.getenv(
    "TAVILY_API_KEY", 
    "YOUR_TAVILY_API_KEY_HERE"      # <-- [INSERT YOUR TAVILY API KEY HERE]
)

# OpenRouter Free Frontier Model Slug (Specialized Finance Frontier LLM)
# Options:
#  - 'inclusionai/ling-3.0-flash-fin:free' (Tailored specifically for financial & macro analysis)
#  - 'google/gemma-4-31b-it:free'
#  - 'nvidia/nemotron-3-super-120b-a12b:free'
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "inclusionai/ling-3.0-flash-fin:free")

# Local Ollama model name
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1")

# Global runtime model override (can be set via --model CLI arg)
SELECTED_MODEL: Optional[str] = os.getenv("CHOSEN_MODEL", None)


# -----------------------------------------------------------------------------
# 2. OpenRouter Chat Wrapper
# -----------------------------------------------------------------------------
class ChatOpenRouter(ChatOpenAI):
    """LangChain ChatOpenAI configured for the OpenRouter API endpoint."""
    def __init__(self, **kwargs):
        kwargs.setdefault("base_url", "https://openrouter.ai/api/v1")
        super().__init__(**kwargs)


# -----------------------------------------------------------------------------
# 3. Pydantic Schemas for Router Node
# -----------------------------------------------------------------------------
class RouteClassification(BaseModel):
    """Pydantic schema for structured output classification from the router node."""
    category: Literal["simple_task", "complex_analysis"] = Field(
        ...,
        description=(
            "Classify the financial query into: "
            "'simple_task' (basic stock lookup, live market price, standard web search, "
            "or direct math/probability calculation) OR "
            "'complex_analysis' (multi-asset macroeconomic synthesis, cross-market forecasting, "
            "portfolio risk stress testing, or deep strategic valuation)."
        ),
    )
    reasoning: str = Field(
        ...,
        description="Brief 1-sentence reasoning for why this classification was assigned."
    )


# -----------------------------------------------------------------------------
# 4. Graph State Definition
# -----------------------------------------------------------------------------
class AgentState(TypedDict):
    """Shared state for the LangGraph financial hybrid agent."""
    messages: Annotated[Sequence[BaseMessage], add_messages]
    classification: Optional[Literal["simple_task", "complex_analysis"]]
    router_reasoning: Optional[str]
    tool_call_count: int
    tools_used: list[str]


# -----------------------------------------------------------------------------
# 5. Financial Tools
# -----------------------------------------------------------------------------
@tool
def web_search_tool(query: str) -> str:
    """Search the web for recent financial news, market headlines, company reports, or macro updates using Tavily."""
    if not TAVILY_API_KEY or "YOUR_TAVILY_API_KEY" in TAVILY_API_KEY:
        return "Error: TAVILY_API_KEY is not configured. Please supply a valid Tavily API key."
    try:
        client = TavilyClient(api_key=TAVILY_API_KEY)
        response = client.search(query=query, max_results=4, search_depth="basic")
        results = response.get("results", [])
        if not results:
            return f"No results found for query: '{query}'"
        formatted = []
        for item in results:
            formatted.append(f"Title: {item.get('title')}\nURL: {item.get('url')}\nContent: {item.get('content')}\n")
        return "\n---\n".join(formatted)
    except Exception as e:
        return f"Tavily search failed: {str(e)}"


@tool
def math_statistics_tool(expression_or_code: str) -> str:
    """Execute mathematical, statistical, or probability calculations using numpy, scipy, and math.
    Input can be a mathematical expression (e.g. 'stats.norm.cdf(1.96)') or multi-line python code
    that sets variables or returns a result.
    Available pre-imported libraries: np (numpy), stats (scipy.stats), math.
    """
    safe_globals = {
        "__builtins__": {
            "abs": abs, "round": round, "min": min, "max": max,
            "sum": sum, "pow": pow, "len": len, "float": float,
            "int": int, "str": str, "list": list, "dict": dict, "range": range
        },
        "np": np,
        "numpy": np,
        "stats": stats,
        "scipy": stats,
        "math": math,
    }
    local_vars: dict[str, Any] = {}

    try:
        # Try evaluating as a single expression first
        result = eval(expression_or_code, safe_globals, local_vars)
        return json.dumps({"result": float(result) if isinstance(result, (np.floating, float)) else str(result)})
    except Exception:
        pass

    try:
        # Fall back to multi-line execution
        exec(expression_or_code, safe_globals, local_vars)
        cleaned_locals = {
            k: float(v) if isinstance(v, (np.floating, float)) else (v.tolist() if isinstance(v, np.ndarray) else str(v))
            for k, v in local_vars.items()
            if not k.startswith("_")
        }
        return json.dumps({"computed_variables": cleaned_locals})
    except Exception as e:
        return f"Math execution error: {str(e)}"


@tool
def market_data_tool(ticker: str) -> str:
    """Fetch current market data, price, valuation ratios, and 52-week metrics for a stock ticker using yfinance."""
    try:
        clean_ticker = ticker.strip().upper().replace("$", "")
        stock = yf.Ticker(clean_ticker)
        
        # Fast info lookup
        fast = getattr(stock, "fast_info", None)
        info = stock.info or {}
        
        current_price = getattr(fast, "last_price", None) or info.get("currentPrice") or info.get("regularMarketPrice")
        
        payload = {
            "ticker": clean_ticker,
            "current_price": current_price,
            "currency": getattr(fast, "currency", None) or info.get("currency", "USD"),
            "market_cap": getattr(fast, "market_cap", None) or info.get("marketCap"),
            "trailing_pe": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "fifty_two_week_high": getattr(fast, "year_high", None) or info.get("fiftyTwoWeekHigh"),
            "fifty_two_week_low": getattr(fast, "year_low", None) or info.get("fiftyTwoWeekLow"),
            "dividend_yield": info.get("dividendYield"),
            "summary": info.get("longBusinessSummary", "")[:250] + "..." if info.get("longBusinessSummary") else None
        }
        return json.dumps(payload, indent=2)
    except Exception as e:
        return f"Market data fetch error for {ticker}: {str(e)}"


# Tools list bound to the agents
ALL_TOOLS = [web_search_tool, math_statistics_tool, market_data_tool]


# -----------------------------------------------------------------------------
# 6. Node Implementations
# -----------------------------------------------------------------------------
def router_node(state: AgentState) -> dict:
    """The Router (Local): Uses ChatOllama (llama3.1) to classify queries into simple_task or complex_analysis."""
    print(f"\n[STEP 1: ROUTER] Analyzing user query: {state['messages'][-1].content}", flush=True)
    router_llm = ChatOllama(
        model=OLLAMA_MODEL,
        temperature=0.0
    ).with_structured_output(RouteClassification)

    query = str(state["messages"][-1].content)
    prompt = (
        "Classify the following financial request into either 'simple_task' or 'complex_analysis'.\n"
        "- 'simple_task': single stock/ticker price lookups, basic market quotes, simple web searches, "
        "or straightforward math / standard statistical probability calculations.\n"
        "- 'complex_analysis': multi-layered cross-asset forecasting, macroeconomic sentiment synthesis, "
        "inter-market correlations, multi-factor portfolio stress testing, or deep investment strategy.\n\n"
        f"User Query: {query}"
    )

    try:
        classification_result: RouteClassification = router_llm.invoke(prompt)
        category = classification_result.category
        reasoning = classification_result.reasoning
    except Exception as e:
        last_text = query.lower()
        if any(term in last_text for term in ["macro", "forecast", "synthesis", "cross-asset", "portfolio risk", "correlation"]):
            category = "complex_analysis"
        else:
            category = "simple_task"
        reasoning = f"Heuristic fallback routing due to parsing exception: {e}"

    print(f"[ROUTER RESULT] Category: -> {category.upper()} <- | Reasoning: {reasoning}", flush=True)
    return {
        "classification": category,
        "router_reasoning": reasoning
    }


def local_worker_node(state: AgentState) -> dict:
    """The Local Worker: Handles simple_task queries using local ChatOllama with tools bound."""
    call_count = state.get("tool_call_count", 0)
    print(f"[STEP 2: LOCAL WORKER] Invoking local Ollama model (tool loop {call_count})...", flush=True)
    
    # If we already executed tool calls, don't re-bind tools so the model outputs the final answer
    base_llm = ChatOllama(model=OLLAMA_MODEL, temperature=0.1)
    llm = base_llm if call_count >= 1 else base_llm.bind_tools(ALL_TOOLS)

    system_msg = SystemMessage(
        content=(
            "You are an efficient, accurate financial assistant running locally. "
            "Use the provided tools (market_data_tool, web_search_tool, math_statistics_tool) "
            "to answer stock prices, run quantitative math/probabilities, or look up recent news. "
            "Be direct, precise, and cite numerical tool results. If tool results are present, summarize them concisely."
        )
    )

    messages = [system_msg] + list(state["messages"])
    response = llm.invoke(messages)
    if hasattr(response, "tool_calls") and response.tool_calls:
        print(f"[LOCAL WORKER] Requesting tools: {[t['name'] for t in response.tool_calls]}", flush=True)
    return {"messages": [response]}


def remote_heavy_lifter_node(state: AgentState) -> dict:
    """The Heavy Lifter (Remote): Handles complex_analysis queries using a frontier model via OpenRouter."""
    call_count = state.get("tool_call_count", 0)
    model_to_use = SELECTED_MODEL or OPENROUTER_MODEL
    print(f"[STEP 2: REMOTE HEAVY LIFTER] Invoking OpenRouter frontier model ({model_to_use}) (tool loop {call_count})...", flush=True)
    
    base_llm = ChatOpenRouter(
        api_key=OPENROUTER_API_KEY,
        model=model_to_use,
        temperature=0.2
    )
    # If tool round already ran, encourage direct synthesis without re-calling tools
    llm = base_llm if call_count >= 1 else base_llm.bind_tools(ALL_TOOLS)

    system_msg = SystemMessage(
        content=(
            "You are a Senior Quantitative Strategist and Macro Portfolio Analyst. "
            "You handle complex financial inquiries, cross-asset forecasting, and macroeconomic sentiment synthesis. "
            "You have access to live market tools, web search, and statistical calculation tools. "
            "Provide rigorous, multi-factor analysis, articulate structural drivers, and deliver institutional-grade commentary. "
            "When tool results are available, synthesize them into a coherent macro scenario directly."
        )
    )

    messages = [system_msg] + list(state["messages"])
    if call_count >= 1:
        synthesis_reminder = HumanMessage(
            content=(
                "All relevant data and search context have been collected above. "
                "Do NOT generate further tool calls or tags. "
                "Deliver your comprehensive final cross-asset synthesis and macroeconomic forecast now."
            )
        )
        messages.append(synthesis_reminder)

    response = llm.invoke(messages)
    if hasattr(response, "tool_calls") and response.tool_calls:
        print(f"[REMOTE HEAVY LIFTER] Requesting tools: {[t['name'] for t in response.tool_calls]}", flush=True)
    return {"messages": [response]}


# -----------------------------------------------------------------------------
# 7. Edge Conditional Logic
# -----------------------------------------------------------------------------
def route_after_classification(state: AgentState) -> Literal["local_worker", "remote_heavy_lifter"]:
    """Conditional Edge: Directs task from the router to either Local Worker or Remote Heavy Lifter."""
    if SELECTED_MODEL in ("ollama", "local", "llama3.1"):
        return "local_worker"
    if SELECTED_MODEL and SELECTED_MODEL not in ("auto", "hybrid"):
        return "remote_heavy_lifter"
    category = state.get("classification")
    if category == "complex_analysis":
        return "remote_heavy_lifter"
    return "local_worker"


def should_continue(state: AgentState) -> Literal["tools", "__end__"]:
    """Conditional Edge: Inspects if the last message contains tool calls. If so, invoke ToolNode; otherwise END."""
    messages = state["messages"]
    last_message = messages[-1]
    call_count = state.get("tool_call_count", 0)

    if hasattr(last_message, "tool_calls") and len(last_message.tool_calls) > 0 and call_count < 2:
        return "tools"
    return END


def route_after_tools(state: AgentState) -> Literal["local_worker", "remote_heavy_lifter"]:
    """Conditional Edge: Returns execution back to the node that initiated the tool call."""
    category = state.get("classification")
    if category == "complex_analysis":
        return "remote_heavy_lifter"
    return "local_worker"


def tools_execution_node(state: AgentState) -> dict:
    """Wrapper node for tool execution that increments tool_call_count and records tools_used."""
    last_msg = state["messages"][-1]
    new_tools = []
    if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
        new_tools = [t["name"] for t in last_msg.tool_calls]
        print(f"[STEP 3: TOOLS NODE] Executing requested tools: {new_tools}", flush=True)

    tool_node = ToolNode(ALL_TOOLS)
    result = tool_node.invoke(state)
    result["tool_call_count"] = state.get("tool_call_count", 0) + 1

    existing_tools = list(state.get("tools_used") or [])
    for t in new_tools:
        if t not in existing_tools:
            existing_tools.append(t)
    result["tools_used"] = existing_tools
    return result


# -----------------------------------------------------------------------------
# 8. Graph Construction
# -----------------------------------------------------------------------------
def build_hybrid_finance_graph() -> StateGraph:
    """Constructs and compiles the hybrid LangGraph agent."""
    builder = StateGraph(AgentState)

    # Add nodes
    builder.add_node("router", router_node)
    builder.add_node("local_worker", local_worker_node)
    builder.add_node("remote_heavy_lifter", remote_heavy_lifter_node)
    builder.add_node("tools", tools_execution_node)

    # Entry edge
    builder.add_edge(START, "router")

    # Routing conditional edge: router -> local_worker OR remote_heavy_lifter
    builder.add_conditional_edges(
        "router",
        route_after_classification,
        {
            "local_worker": "local_worker",
            "remote_heavy_lifter": "remote_heavy_lifter"
        }
    )

    # Tool calling loops
    builder.add_conditional_edges(
        "local_worker",
        should_continue,
        {
            "tools": "tools",
            END: END
        }
    )

    builder.add_conditional_edges(
        "remote_heavy_lifter",
        should_continue,
        {
            "tools": "tools",
            END: END
        }
    )

    # Return edge from tools back to the active agent node
    builder.add_conditional_edges(
        "tools",
        route_after_tools,
        {
            "local_worker": "local_worker",
            "remote_heavy_lifter": "remote_heavy_lifter"
        }
    )

    return builder.compile()


# Compile executable graph
graph = build_hybrid_finance_graph()


# -----------------------------------------------------------------------------
# 9. CLI Execution & API JSON Bridge
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    import argparse
    import time

    parser = argparse.ArgumentParser(description="Hybrid Finance LangGraph Agent")
    parser.add_argument("--query", type=str, help="Financial query to execute via graph")
    parser.add_argument("--model", type=str, default=None, help="Specific model slug override")
    parser.add_argument("--json", action="store_true", help="Output pure JSON payload for Express API bridge")
    args = parser.parse_args()

    if args.model:
        SELECTED_MODEL = args.model.strip()

    if args.query:
        query_text = args.query.strip()
        t0 = time.time()
        initial_state = {
            "messages": [HumanMessage(content=query_text)],
            "classification": None,
            "router_reasoning": None,
            "tool_call_count": 0,
            "tools_used": []
        }

        last_event = None
        for event in graph.stream(initial_state, stream_mode="values"):
            last_event = event

        elapsed = time.time() - t0
        final_msg = last_event["messages"][-1] if last_event else None
        response_text = final_msg.content if final_msg else "No response generated."

        resolved_model = SELECTED_MODEL or (
            "ollama/llama3.1" if (last_event and last_event.get("classification") == "simple_task") else OPENROUTER_MODEL
        )

        if args.json:
            output_payload = {
                "success": True,
                "query": query_text,
                "model": resolved_model,
                "classification": last_event.get("classification") if last_event else "simple_task",
                "router_reasoning": last_event.get("router_reasoning") if last_event else "",
                "tools_used": last_event.get("tools_used", []) if last_event else [],
                "response": response_text,
                "execution_time_seconds": round(elapsed, 2)
            }
            # Delimit output so caller can cleanly extract JSON even with logging messages
            print("\n__HYBRID_AGENT_JSON_START__", flush=True)
            print(json.dumps(output_payload, ensure_ascii=False), flush=True)
            print("__HYBRID_AGENT_JSON_END__", flush=True)
        else:
            print(f"\n[FINAL RESPONSE] (Executed in {elapsed:.2f}s):")
            print(response_text)
            print("-" * 70)
        sys.exit(0)

    # Default Interactive CLI Demo (when run without arguments)
    print("=" * 70)
    print("HYBRID LOCAL/REMOTE FINANCE AGENT INITIALIZED")
    print(f"- Router & Local Worker: Ollama ({OLLAMA_MODEL})")
    print(f"- Remote Heavy Lifter:   OpenRouter ({OPENROUTER_MODEL})")
    print("=" * 70)

    test_queries = [
        "What is the current stock price of Apple (AAPL) and its 52-week high?",
        "Using scipy stats, calculate the standard normal cumulative probability at z = 1.96 and calculate a 95% Value at Risk for a $500,000 portfolio with 1.5% daily volatility.",
        "Synthesize current macroeconomic indicators (inflation vs yield curve) into a cross-asset forecasting scenario for equities vs commodities over the next 6 months."
    ]

    for query in test_queries:
        print(f"\n>>> USER QUERY: {query}")
        initial_state = {
            "messages": [HumanMessage(content=query)],
            "classification": None,
            "router_reasoning": None,
            "tool_call_count": 0,
            "tools_used": []
        }

        # Stream graph execution steps
        for event in graph.stream(initial_state, stream_mode="values"):
            pass

        final_msg = event["messages"][-1]
        print("\n[FINAL RESPONSE]:")
        print(final_msg.content)
        print("-" * 70)
