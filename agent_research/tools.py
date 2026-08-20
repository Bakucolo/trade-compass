import os
import yfinance as yf
from tavily import TavilyClient
from fredapi import Fred
from sec_edgar_downloader import Downloader
import chromadb
import json

# We will initialize ChromaDB in main to pass the client to the tool if needed, 
# or we can initialize it globally here.
_chroma_client = None

def get_chroma_client():
    global _chroma_client
    if not _chroma_client:
        _chroma_client = chromadb.PersistentClient(path="./chroma_db")
    return _chroma_client

def search_web(query: str) -> str:
    """Uses the tavily-python library for fetching real-time news and analysis."""
    client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY", ""))
    try:
        response = client.search(query=query, search_depth="advanced")
        return json.dumps(response.get('results', []))
    except Exception as e:
        return f"Error searching web: {str(e)}"

def get_live_price(ticker: str) -> str:
    """Uses yfinance to fetch current price, volume, and basic trailing metrics."""
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        metrics = {
            "current_price": info.get("currentPrice") or info.get("regularMarketPrice"),
            "volume": info.get("volume"),
            "market_cap": info.get("marketCap"),
            "trailing_pe": info.get("trailingPE"),
            "dividend_yield": info.get("dividendYield"),
            "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
            "fifty_two_week_low": info.get("fiftyTwoWeekLow")
        }
        return json.dumps(metrics)
    except Exception as e:
        return f"Error fetching price: {str(e)}"

def get_macro_data() -> str:
    """Uses fredapi to fetch current US Interest Rates (Fed Funds) and CPI."""
    try:
        api_key = os.getenv("FRED_API_KEY", "")
        if not api_key:
            return "FRED_API_KEY is not set."
        fred = Fred(api_key=api_key)
        
        # Effective Federal Funds Rate (FEDFUNDS)
        fedfunds = fred.get_series('FEDFUNDS').iloc[-1]
        # Consumer Price Index (CPIAUCSL)
        cpi = fred.get_series('CPIAUCSL').iloc[-1]
        
        return json.dumps({
            "fed_funds_rate_percent": fedfunds,
            "cpi_current_index": cpi
        })
    except Exception as e:
        return f"Error fetching macro data: {str(e)}"

def execute_math(code: str) -> str:
    """A secure, local Python exec() sandbox tool for calculations."""
    allowed_locals = {}
    try:
        # Warning: Using exec() can be dangerous. Overriddem __builtins__ restrict unwanted commands contextually.
        exec(code, {"__builtins__": {}}, allowed_locals)
        return json.dumps(allowed_locals)
    except Exception as e:
        return f"Math execution error: {str(e)}"

def download_sec_filings(ticker: str) -> str:
    """Uses sec-edgar-downloader to fetch the latest 10-K and 10-Q metadata."""
    try:
        # Since reading full 10-K is huge, we will just simulate finding it or download them.
        dl = Downloader("My_Agent", "agent@example.com", "./sec_filings")
        dl.get("10-K", ticker, limit=1, download_details=False)
        dl.get("10-Q", ticker, limit=1, download_details=False)
        return "Latest 10-K and 10-Q documents downloaded to ./sec_filings."
    except Exception as e:
        return f"Error fetching SEC filings: {str(e)}"

def search_memory(ticker: str) -> str:
    """Queries ChromaDB to see if it has past research on this ticker."""
    try:
        client = get_chroma_client()
        collection = client.get_or_create_collection(name="research_memory")
        results = collection.query(
            query_texts=[ticker],
            n_results=1
        )
        if results and results.get("documents") and len(results["documents"][0]) > 0:
            return str(results["documents"][0][0])
        return "No past memory found for this ticker."
    except Exception as e:
        return f"Error searching memory: {str(e)}"

# Define the OpenAI tools JSON schema
TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": "Searches the web for recent news, sentiment, or financial analysis.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search query (e.g., 'AAPL earnings news 2026')"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_live_price",
            "description": "Fetches current price, volume, and trailing metrics for a given ticker symbol.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticker": {"type": "string", "description": "The stock ticker symbol (e.g., 'AAPL')"}
                },
                "required": ["ticker"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_macro_data",
            "description": "Fetches current macroeconomic data (US Interest Rates, CPI) from FRED.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "execute_math",
            "description": "Executes standard Python math logic to calculate formulas and returns the variables defined.",
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {"type": "string", "description": "Python code string assigning mathematical results to local variables. No imports needed. E.g., 'valuation = 100 / 0.05'"}
                },
                "required": ["code"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "download_sec_filings",
            "description": "Checks the SEC Edgar database for the latest 10-K and 10-Q filings for a ticker.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticker": {"type": "string", "description": "The ticker symbol to find SEC filings for."}
                },
                "required": ["ticker"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_memory",
            "description": "Searches the agent's long-term memory (ChromaDB) for previous research or context on the ticker.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticker": {"type": "string", "description": "The ticker symbol to search past memory for."}
                },
                "required": ["ticker"]
            }
        }
    }
]

# Dispatcher mapping for easy execution in ReAct loop
TOOL_DISPATCH = {
    "search_web": search_web,
    "get_live_price": get_live_price,
    "get_macro_data": get_macro_data,
    "execute_math": execute_math,
    "download_sec_filings": download_sec_filings,
    "search_memory": search_memory
}
