from langgraph.graph import StateGraph, START, END
from ai_evaluator import DebateState, update_history_node
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

# --- WEB STATELESS GRAPH WORKFLOW ---

web_graph = StateGraph(DebateState)

# Add all granular router, tool, and evaluation nodes
web_graph.add_node("decide_knowledge_source", decide_knowledge_source_node)
web_graph.add_node("rag_tool", rag_tool_node)
web_graph.add_node("web_search_tool", web_search_tool_node)
web_graph.add_node("evaluate_topic_novelty", evaluate_topic_novelty_node)
web_graph.add_node("evaluate_logic", evaluate_logic_node)
web_graph.add_node("evaluate_rebuttal", evaluate_rebuttal_node)
web_graph.add_node("evaluate_stance", evaluate_stance_node)
web_graph.add_node("evaluate_delivery", evaluate_delivery_node)
web_graph.add_node("aggregate_scores", aggregate_scores_node)
web_graph.add_node("update_history", update_history_node)

# Set up edges
web_graph.add_edge(START, "decide_knowledge_source")

def route_knowledge_source(state: DebateState):
    strategy = state.get("knowledge_strategy", "internal")
    confidence = state.get("router_confidence", 1.0)
    
    if strategy == "rag":
        if confidence < 0.5:
            print(f"[Web Graph Routing] Strategy is RAG but confidence ({confidence}) is low. Routing to Web Search.")
            return "web_search_tool"
        return "rag_tool"
    elif strategy == "web":
        return "web_search_tool"
    else:
        return "evaluate_topic_novelty"

# Conditional routing from router node
web_graph.add_conditional_edges(
    "decide_knowledge_source",
    route_knowledge_source,
    {
        "rag_tool": "rag_tool",
        "web_search_tool": "web_search_tool",
        "evaluate_topic_novelty": "evaluate_topic_novelty"
    }
)

# Connect tools to evaluation pipeline
web_graph.add_edge("rag_tool", "evaluate_topic_novelty")
web_graph.add_edge("web_search_tool", "evaluate_topic_novelty")

# Sequential judges
web_graph.add_edge("evaluate_topic_novelty", "evaluate_logic")
web_graph.add_edge("evaluate_logic", "evaluate_rebuttal")
web_graph.add_edge("evaluate_rebuttal", "evaluate_stance")
web_graph.add_edge("evaluate_stance", "evaluate_delivery")
web_graph.add_edge("evaluate_delivery", "aggregate_scores")
web_graph.add_edge("aggregate_scores", "update_history")
web_graph.add_edge("update_history", END)

web_workflow = web_graph.compile()
