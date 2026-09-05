from langchain.tools import tool
import requests 
from bs4 import BeautifulSoup
from tavily import TavilyClient
import os
from dotenv import load_dotenv
load_dotenv()
from rich import print
tavily  = TavilyClient(
    api_key=os.getenv("TAVILY_API_KEY")
)

@tool 
def web_search(query:str)->str:
    """Search the Web for recent and reliable information on a topic.Return Titles,url and snippets"""
    results = tavily.search(query=query,max_results=3)
    out = []
    for r in results['results']:
        out.append(
            f"Title:{r['title']}\nURL:{r['url']}\nSnippet:{r['content'][:300]}\n"
        )
    return "\n------\n".join(out)

@tool
def extract_webpage(url: str) -> str:
    """
    Extract the main textual content from a webpage URL
    using requests and BeautifulSoup.
    """

    try:
        headers = {
            "User-Agent": "Mozilla/5.0"
        }

        response = requests.get(
            url,
            headers=headers,
            timeout=10
        )

        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Remove unnecessary elements
        for element in soup([
            "script",
            "style",
            "nav",
            "footer",
            "header",
            "aside"
        ]):
            element.decompose()

        # Extract text
        text = soup.get_text(separator=" ", strip=True)

        return text[:3000]

    except requests.exceptions.RequestException as e:
        return f"Error fetching webpage: {str(e)}"

    except Exception as e:
        return f"Error extracting webpage: {str(e)}"

