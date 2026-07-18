from langgraph.graph import StateGraph, START, END
from ai_evaluator import DebateState, update_history_node
from ai_evaluator.config import ROUNDS
from ai_evaluator.services.evaluator import (
    decide_knowledge_source_node,
    rag_tool_node,
    web_search_tool_node,
    evaluate_topic_novelty_node,
    evaluate_logic_node,
    evaluate_rebuttal_node,
    evaluate_stance_node,
    evaluate_delivery_node,
    aggregate_scores_node
)


# --- CLI-ONLY NODES ---

def read_multiline_argument(prompt_label: str) -> str:
    """
    Reads a full (possibly multi-line/pasted) argument safely.
    Reads line-by-line until the user enters a blank line.
    """
    print(f"{prompt_label} (paste your argument, then press Enter on an empty line to submit):")
    lines = []
    while True:
        try:
            line = input()
        except EOFError:
            break
        if line.strip() == "" and lines:
            break
        if line.strip() == "" and not lines:
            break
        lines.append(line)
    return "\n".join(lines).strip()


def get_input_node(state: DebateState):
    user = state["current_user"]
    if user == "user1":
        print(f"\n=== ROUND {state['current_round']} ===")

    stance = state["user1_stance"] if user == "user1" else state["user2_stance"]
    arg = read_multiline_argument(f"{user} ({stance}) argument")
    return {"current_argument": arg}


def display_scores_node(state: DebateState):
    user = state["current_user"]
    stance = state["user1_stance"] if user == "user1" else state["user2_stance"]
    print(f"\n--- SCORES ({user}, arguing {stance}) ---")
    print("Topic:  ", state["topic_score"], "(gate)")
    print("Stance: ", state["stance_score"], "(gate)")
    print("Related:", state["related_score"])
    print("Fact:   ", state["fact_score"])
    print("Novelty:", state["novelty_score"])
    print("Delivery:", state.get("delivery_score", 100.0))

    flags = []
    if state.get("gated"):
        flags.append("TOPIC GATE")
    if state.get("stance_gated"):
        flags.append("STANCE GATE")

    if flags:
        print(f"Final:  {state['final_score']}  ⚠ {' + '.join(flags)} TRIGGERED")
    else:
        print("Final:  ", state["final_score"])

    print("\n--- JUDGES' REASONINGS ---")
    for reason in state.get("reasoning", []):
        print(reason)
    print("---------------------------")
    return {}


def final_result_node(state: DebateState):
    print("\n===== FINAL RESULT =====")
    print("User1:", round(state["user1_total"], 2))
    print("User2:", round(state["user2_total"], 2))

    if state["user1_total"] > state["user2_total"]:
        print("Winner: User1")
    elif state["user2_total"] > state["user1_total"]:
        print("Winner: User2")
    else:
        print("Draw")
    return {}


# --- GRAPH CONSTRUCTION ---

graph = StateGraph(DebateState)

graph.add_node("get_input", get_input_node)
graph.add_node("decide_knowledge_source", decide_knowledge_source_node)
graph.add_node("rag_tool", rag_tool_node)
graph.add_node("web_search_tool", web_search_tool_node)
graph.add_node("evaluate_topic_novelty", evaluate_topic_novelty_node)
graph.add_node("evaluate_logic", evaluate_logic_node)
graph.add_node("evaluate_rebuttal", evaluate_rebuttal_node)
graph.add_node("evaluate_stance", evaluate_stance_node)
graph.add_node("evaluate_delivery", evaluate_delivery_node)
graph.add_node("aggregate_scores", aggregate_scores_node)
graph.add_node("display_scores", display_scores_node)
graph.add_node("update_history", update_history_node)
graph.add_node("final_result", final_result_node)

graph.add_edge(START, "get_input")
graph.add_edge("get_input", "decide_knowledge_source")

def route_knowledge_source(state: DebateState):
    strategy = state.get("knowledge_strategy", "internal")
    confidence = state.get("router_confidence", 1.0)
    
    if strategy == "rag":
        if confidence < 0.5:
            print(f"[Graph Routing] Strategy is RAG but confidence ({confidence}) is low. Routing to Web Search.")
            return "web_search_tool"
        return "rag_tool"
    elif strategy == "web":
        return "web_search_tool"
    else:
        return "evaluate_topic_novelty"

# Conditional routing based on router strategy
graph.add_conditional_edges(
    "decide_knowledge_source",
    route_knowledge_source,
    {
        "rag_tool": "rag_tool",
        "web_search_tool": "web_search_tool",
        "evaluate_topic_novelty": "evaluate_topic_novelty"
    }
)

# Connect tools to downstream evaluation
graph.add_edge("rag_tool", "evaluate_topic_novelty")
graph.add_edge("web_search_tool", "evaluate_topic_novelty")

# Judges pipeline
graph.add_edge("evaluate_topic_novelty", "evaluate_logic")
graph.add_edge("evaluate_logic", "evaluate_rebuttal")
graph.add_edge("evaluate_rebuttal", "evaluate_stance")
graph.add_edge("evaluate_stance", "evaluate_delivery")
graph.add_edge("evaluate_delivery", "aggregate_scores")
graph.add_edge("aggregate_scores", "display_scores")
graph.add_edge("display_scores", "update_history")


def route_next(state: DebateState):
    if state["current_round"] > ROUNDS:
        return "final_result"
    return "get_input"


graph.add_conditional_edges(
    "update_history",
    route_next,
    {
        "get_input": "get_input",
        "final_result": "final_result"
    }
)

graph.add_edge("final_result", END)

workflow = graph.compile()

# Generate and save the updated graph diagram
try:
    img = workflow.get_graph().draw_mermaid_png()
    with open("/Users/hardikthumar/Documents/debate/graph_new.png", "wb") as f:
        f.write(img)
    print("[Graph] Successfully saved updated LangGraph diagram to graph_new.png")
except Exception as e:
    print(f"[Graph Warning] Could not save graph PNG: {e}")

