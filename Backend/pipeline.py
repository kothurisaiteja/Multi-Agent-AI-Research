from Agents import build_reader_agent, build_search_agent, writer_chain, critic_chain
import time


# =========================================================
# RETRY HELPER FOR NORMAL INVOKE CALLS
# =========================================================

def retry_call(func, *args, retries=3, delay=10, **kwargs):
    for attempt in range(retries):
        try:
            return func(*args, **kwargs)

        except Exception as e:
            if attempt == retries - 1:
                raise

            print(
                f"\nAPI temporarily unavailable. "
                f"Retrying in {delay} seconds..."
            )

            time.sleep(delay)


# =========================================================
# RETRY HELPER FOR STREAMING CALLS
# =========================================================

def retry_stream(stream_func, *args, retries=3, delay=10, **kwargs):
    for attempt in range(retries):
        try:
            yield from stream_func(*args, **kwargs)
            return

        except Exception as e:
            if attempt == retries - 1:
                raise

            print(
                f"\nAPI temporarily unavailable. "
                f"Retrying in {delay} seconds..."
            )

            time.sleep(delay)


# =========================================================
# ORIGINAL PIPELINE
# DO NOT TOUCH
# =========================================================

def run_research_pipeline(topic : str)->dict:
    print("\n"+"="*50)
    print("step 1 -Search agent is working")
    print("="*50)

    # step 1 : CREATE SEARCH AGENT
    state = {}

    search_agent = build_search_agent()
    search_result = search_agent.invoke({
        "messages":[("user",f"Find recent,reliable and detailed information about:{topic}")]
    })
    state['search_result']=search_result['messages'][-1].content

    print("\n Search results",state['search_result'])

    #step 2 : Reader agent
    print("\n"+"="*50)
    print("step 2 -Reader agent is working")
    print("="*50)

    reader_agent = build_reader_agent()
    reader_result = reader_agent.invoke({
        "messages":[("user",
            f"Based on the following search results about '{topic}', "
            f"pick the most relevant URL and scrape it for deeper content.\n\n"
            f"Search Results:\n{state['search_result'][:400]}"
            )]
    })

    state['scraped_content'] = reader_result['messages'][-1].content

    print("\nScraped Content : \n",state['scraped_content'])

    #step 3 : Writer Chain
    print("\n"+"="*50)
    print("step 3 - Writer chain is working")
    print("="*50)

    research_combined = (
        f"Search Results:\n{state['search_result']}\n\n"
        f"Detailed Scrap Content:\n{state['scraped_content']}\n\n"
    )

    state['report'] = ""

    for chunk in writer_chain.stream({
        "topic": topic,
        "research": research_combined
    }):
        state['report'] += chunk
        print(chunk, end="", flush=True)

    print("\n")

    print("\n Final report \n",state['report'])

    #Critic Report
    print("\n"+"="*50)
    print("step 4 - critic chain is working")
    print("="*50)

    state['feedback'] = critic_chain.invoke({
        "report":state['report']
    })

    print("\nCritic Report",state['feedback'])

    return state


# =========================================================
# STREAMING PIPELINE
# THIS IS THE ONE USED BY FASTAPI / REACT
# =========================================================

def run_research_pipeline_stream(topic: str):

    state = {}

    # =====================================================
    # SEARCH AGENT
    # =====================================================

    yield {
        "type": "agent",
        "agent": "search",
        "status": "running",
        "message": "Searching the web..."
    }

    search_agent = build_search_agent()

    search_result = retry_call(
        search_agent.invoke,
        {
            "messages": [
                (
                    "user",
                    f"Find recent, reliable and detailed information about: {topic}"
                )
            ]
        }
    )

    state["search_result"] = search_result["messages"][-1].content

    yield {
        "type": "agent",
        "agent": "search",
        "status": "completed",
        "message": "Search completed"
    }


    # =====================================================
    # READER AGENT
    # =====================================================

    yield {
        "type": "agent",
        "agent": "reader",
        "status": "running",
        "message": "Reading the most relevant source..."
    }

    reader_agent = build_reader_agent()

    reader_result = retry_call(
        reader_agent.invoke,
        {
            "messages": [
                (
                    "user",
                    f"Based on the following search results about '{topic}', "
                    f"pick the most relevant URL and scrape it for deeper content.\n\n"
                    f"Search Results:\n{state['search_result'][:400]}"
                )
            ]
        }
    )

    state["scraped_content"] = reader_result["messages"][-1].content

    yield {
        "type": "agent",
        "agent": "reader",
        "status": "completed",
        "message": "Source analysis completed"
    }


    # =====================================================
    # WRITER AGENT
    # =====================================================

    yield {
        "type": "agent",
        "agent": "writer",
        "status": "running",
        "message": "Generating research report..."
    }

    research_combined = (
        f"Search Results:\n{state['search_result']}\n\n"
        f"Detailed Scrap Content:\n{state['scraped_content']}\n\n"
    )

    state["report"] = ""

    token_count = 0

    # Writer streaming with retry
    for chunk in retry_stream(
        writer_chain.stream,
        {
            "topic": topic,
            "research": research_combined
        }
    ):

        state["report"] += chunk
        token_count += len(chunk.split())

        yield {
            "type": "token",
            "agent": "writer",
            "content": chunk
        }

    yield {
        "type": "agent",
        "agent": "writer",
        "status": "completed",
        "message": "Research report generated",
        "tokens": token_count
    }


    # =====================================================
    # CRITIC AGENT
    # =====================================================

    yield {
        "type": "agent",
        "agent": "critic",
        "status": "running",
        "message": "Evaluating research quality..."
    }

    state["feedback"] = ""

    critic_token_count = 0

    # Critic streaming with retry
    for chunk in retry_stream(
        critic_chain.stream,
        {
            "report": state["report"]
        }
    ):

        state["feedback"] += chunk
        critic_token_count += len(chunk.split())

        yield {
            "type": "token",
            "agent": "critic",
            "content": chunk
        }

    yield {
        "type": "agent",
        "agent": "critic",
        "status": "completed",
        "message": "Evaluation completed",
        "tokens": critic_token_count
    }


    # =====================================================
    # COMPLETE
    # =====================================================

    yield {
        "type": "complete",
        "topic": topic,
        "report": state["report"],
        "feedback": state["feedback"],
        "search_result": state["search_result"],
        "scraped_content": state["scraped_content"]
    }


# =========================================================
# RUN ORIGINAL PIPELINE DIRECTLY
# =========================================================

if __name__ == "__main__":
    topic = input("\n Enter a Research Topic :")
    run_research_pipeline(topic)