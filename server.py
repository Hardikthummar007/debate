import os
import json
import asyncio
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse
from pydantic import BaseModel
import uvicorn

from ai_evaluator.graphs import web_workflow
from ai_evaluator.services.evaluator import (
    decide_knowledge_source_node,
    rag_tool_node,
    web_search_tool_node,
    evaluate_topic_novelty_node,
    evaluate_logic_node,
    evaluate_rebuttal_node,
    evaluate_stance_node,
    evaluate_delivery_node,
    aggregate_scores_node,
    update_history_node,
    evaluate_node
)
from ai_evaluator.utils.vector_store import _topic_stores, get_topic_store

# Initialize FastAPI App
app = FastAPI(
    title="AI Debate Arena",
    description="Stateless LangGraph-powered Multi-Judge Debating Platform"
)

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# -------------------------
# PYDANTIC SCHEMAS
# -------------------------
class WebDebateState(BaseModel):
    topic: str
    user1_args: List[str]
    user2_args: List[str]
    user1_stance: Optional[str] = "FOR"
    user2_stance: Optional[str] = "AGAINST"
    current_round: int
    current_user: str
    current_argument: str

    reasoning: Optional[List[str]] = []
    related_score: Optional[float] = 0.0
    novelty_score: Optional[float] = 0.0
    topic_score: Optional[float] = 0.0
    fact_score: Optional[float] = 0.0
    stance_score: Optional[float] = 0.0
    delivery_score: Optional[float] = 0.0
    final_score: Optional[float] = 0.0

    gated: Optional[bool] = False
    stance_gated: Optional[bool] = False
    user1_total: Optional[float] = 0.0
    user2_total: Optional[float] = 0.0
    retrieved_facts: Optional[str] = ""
    raw_transcript: Optional[str] = ""
    is_ai: Optional[bool] = False
    difficulty: Optional[str] = "medium"


# -------------------------
# ENDPOINTS
# -------------------------

@app.get("/background.png")
async def serve_background():
    """Serves the Game of Thrones custom background image."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    bg_path = os.path.join(current_dir, "background.png")
    if os.path.exists(bg_path):
        return FileResponse(bg_path)
    raise HTTPException(status_code=404, detail="Background image not found.")


@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    """Serves the visually stunning, animated Single Page Application."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    index_path = os.path.join(current_dir, "index.html")
    try:
        with open(index_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="index.html not found.")


@app.post("/api/evaluate", response_model=WebDebateState)
async def evaluate_argument(state: WebDebateState):
    """
    Stateless endpoint that accepts the current debate state, runs the
    LangGraph evaluation pipeline, and returns the updated state.
    """
    # Convert Pydantic model to the dictionary format expected by the LangGraph State
    input_state = state.model_dump()

    try:
        # Invoke the stateless compiled LangGraph workflow
        updated_state = web_workflow.invoke(input_state)
        return updated_state
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"LangGraph execution failed: {str(e)}"
        )


@app.post("/api/evaluate/stream")
async def evaluate_argument_stream(state: WebDebateState):
    """
    Stateless endpoint that accepts the current debate state, runs the
    evaluation nodes sequentially, and streams updates.
    """
    input_state = state.model_dump()
    
    async def stream_evaluation_generator(state_dict: dict):
        state = {
            "reasoning": [],
            "related_score": 0.0,
            "novelty_score": 0.0,
            "topic_score": 0.0,
            "fact_score": 0.0,
            "stance_score": 50.0,
            "delivery_score": 100.0,
            "final_score": 0.0,
            "gated": False,
            "stance_gated": False,
            "user1_stance": "FOR",
            "user2_stance": "AGAINST",
            "raw_transcript": "",
            **state_dict
        }

        yield_queue = asyncio.Queue()

        def push_update(event_name, data):
            try:
                loop = asyncio.get_event_loop()
                loop.call_soon_threadsafe(yield_queue.put_nowait, (event_name, data))
            except Exception:
                pass

        async def run_judge_task(name, func, state_arg):
            push_update(f"{name}_start", {"message": f"Judge {name[-1]} starting evaluation..."})
            res = await asyncio.to_thread(func, state_arg)
            push_update(f"{name}_complete", res)
            return res

        async def run_pipeline():
            try:
                # 1. Routing step (Sequential)
                push_update("ddg_start", {"message": "Routing query and deciding knowledge source..."})
                routing = await asyncio.to_thread(decide_knowledge_source_node, state)
                merged_state = {**state, **routing}
                
                strat_name = routing.get("knowledge_strategy", "internal").upper()
                router_conf = routing.get("router_confidence", 1.0)
                push_update("ddg_complete", {"message": f"Router decided: {strat_name} (Confidence: {router_conf})"})

                # 2. Tool Execution step (Sequential)
                strategy = merged_state.get("knowledge_strategy", "internal")
                confidence = merged_state.get("router_confidence", 1.0)
                search_q = merged_state.get("search_query", "")
                
                tool_updates = {}
                if strategy == "rag":
                    if confidence < 0.5:
                        push_update("ddg_start", {"message": f"RAG confidence ({confidence}) is low. Falling back to Live Web Search..."})
                        tool_updates = await asyncio.to_thread(web_search_tool_node, merged_state)
                        push_update("ddg_complete", {"message": "Finished live web search retrieval.", "strategy": "web"})
                    else:
                        push_update("ddg_start", {"message": f"Retrieving facts from local RAG store (query: \"{search_q}\")..."})
                        tool_updates = await asyncio.to_thread(rag_tool_node, merged_state)
                        push_update("ddg_complete", {"message": "Finished local RAG context retrieval.", "strategy": "rag"})
                elif strategy == "web":
                    push_update("ddg_start", {"message": f"Querying DuckDuckGo live search (query: \"{search_q}\")..."})
                    tool_updates = await asyncio.to_thread(web_search_tool_node, merged_state)
                    push_update("ddg_complete", {"message": "Finished live web search retrieval.", "strategy": "web"})
                else:
                    push_update("ddg_complete", {"message": "Relying on internal knowledge (no retrieval needed)", "strategy": "internal"})

                merged_state = {**merged_state, **tool_updates}

                # 3. Sequential Judges step - only launched after tool search is fully completed!
                reasoning_updates = []
                
                res3 = await run_judge_task("judge3", evaluate_topic_novelty_node, merged_state)
                if res3:
                    for k, v in res3.items():
                        if k != "reasoning":
                            merged_state[k] = v
                        else:
                            reasoning_updates.extend(v)
                
                res1 = await run_judge_task("judge1", evaluate_logic_node, merged_state)
                if res1:
                    for k, v in res1.items():
                        if k != "reasoning":
                            merged_state[k] = v
                        else:
                            reasoning_updates.extend(v)
                
                res2 = await run_judge_task("judge2", evaluate_rebuttal_node, merged_state)
                if res2:
                    for k, v in res2.items():
                        if k != "reasoning":
                            merged_state[k] = v
                        else:
                            reasoning_updates.extend(v)
                
                res4 = await run_judge_task("judge4", evaluate_stance_node, merged_state)
                if res4:
                    for k, v in res4.items():
                        if k != "reasoning":
                            merged_state[k] = v
                        else:
                            reasoning_updates.extend(v)
                
                res5 = await run_judge_task("judge5", evaluate_delivery_node, merged_state)
                if res5:
                    for k, v in res5.items():
                        if k != "reasoning":
                            merged_state[k] = v
                        else:
                            reasoning_updates.extend(v)

                merged_state["reasoning"] = list(merged_state.get("reasoning", [])) + reasoning_updates

                # 4. Final aggregation & history update
                push_update("final_result_start", {"message": "Compiling final scores..."})
                s5 = await asyncio.to_thread(aggregate_scores_node, merged_state)
                merged_state = {**merged_state, **s5}
                
                history_updates = await asyncio.to_thread(update_history_node, merged_state)
                final_state = {**merged_state, **history_updates}
                
                push_update("final_result", final_state)
                push_update("done", {"message": "Evaluation finished."})
            except Exception as pipeline_err:
                push_update("error", {"error": str(pipeline_err)})

        pipeline_task = asyncio.create_task(run_pipeline())

        while not pipeline_task.done() or not yield_queue.empty():
            try:
                event, data = await asyncio.wait_for(yield_queue.get(), timeout=0.1)
                yield f"event: {event}\ndata: {json.dumps(data)}\n\n"
                yield_queue.task_done()
            except asyncio.TimeoutError:
                continue

        await pipeline_task

    return StreamingResponse(stream_evaluation_generator(input_state), media_type="text/event-stream")


class GenerateArgumentRequest(BaseModel):
    topic: str
    stance: str
    opponent_args: List[str]
    ai_args: List[str]
    mode: Optional[str] = "medium"

@app.post("/api/generate_argument")
async def generate_argument(req: GenerateArgumentRequest):
    """
    Endpoint that generates a debate speech for the AI opponent,
    defending the assigned stance under chosen difficulty mode constraints.
    """
    try:
        from ai_evaluator.models.model_loader import llm
        
        mode = (req.mode or "medium").lower()
        difficulty_specs = {
            "easy": {
                "target_band": "20-45 out of 100",
                "instructions": (
                    "* Write like an average person with only a surface-level opinion — NOT a debate expert.\n"
                    "* Maximum 2-3 short sentences total.\n"
                    "* Use ONLY generic, vague claims (e.g. \"it's just better\", \"everyone knows that\").\n"
                    "* Do NOT cite any facts, statistics, studies, or real-world examples.\n"
                    "* Do NOT rebut or even acknowledge the user's argument.\n"
                    "* Do NOT use structured reasoning, logical connectors (\"therefore\", \"because\"), or multi-step logic.\n"
                    "* It is okay — even expected — for the argument to contain a mild logical gap or unsupported leap.\n"
                    "* No counter-attacks, no anticipation of rebuttals, no persuasive techniques."
                ),
            },
            "medium": {
                "target_band": "50-70 out of 100",
                "instructions": (
                    "* Write like a moderately informed person, not an expert.\n"
                    "* 3-5 sentences.\n"
                    "* Include exactly ONE piece of reasoning or example, but keep it generic rather than deeply researched.\n"
                    "* You may loosely acknowledge the user's argument, but do not construct a real rebuttal to it.\n"
                    "* Some structure is fine, but avoid airtight logic or layered reasoning.\n"
                    "* Do not include a counter-attack line or anticipate future objections.\n"
                    "* This should be a solidly average argument: better than easy mode, clearly beatable, and missing depth a strong debater would include."
                ),
            },
            "hard": {
                "target_band": "85-100 out of 100",
                "instructions": (
                    "* Write like an expert debater with subject-matter knowledge.\n"
                    "* 5-8 sentences, tightly structured (claim -> evidence -> reasoning -> rebuttal -> counter-attack).\n"
                    "* Include at least one concrete, verifiable-sounding fact, statistic, or real-world example.\n"
                    "* Directly rebut the specific weak point(s) in the user's argument by name, not generically.\n"
                    "* Anticipate the user's most likely comeback and pre-empt it.\n"
                    "* End with one explicit counter-attack line that goes on the offensive against the user's stance.\n"
                    "* No vague filler — every sentence must add logic, evidence, or rebuttal value."
                ),
            },
        }
        spec = difficulty_specs.get(mode, difficulty_specs["medium"])

        # Format the round-by-round conversation history
        history_formatted = ""
        max_len = max(len(req.opponent_args), len(req.ai_args))
        for idx in range(max_len):
            round_num = idx + 1
            history_formatted += f"Round {round_num}:\n"
            if idx < len(req.opponent_args):
                history_formatted += f"- Opponent (User) Argument: {req.opponent_args[idx]}\n"
            if idx < len(req.ai_args):
                history_formatted += f"- You (AI) Argument: {req.ai_args[idx]}\n"
            history_formatted += "\n"
        
        if not history_formatted.strip():
            history_formatted = "No arguments have been submitted yet. This is the first round of the debate."

        system_prompt = (
            "🧠 AI ARGUMENT GENERATOR\n\n"
            "You are an intelligent debate agent participating in a structured \"User vs AI\" argument system. "
            "Your output will be scored by independent judges on clarity, logic, relevance, persuasiveness, and depth. "
            "You must calibrate the QUALITY of your argument to match the selected difficulty mode below — "
            "this is not just a style preference, it is a hard constraint on how strong the argument is allowed to be.\n\n"
            "⸻\n\n"
            f"🎯 SELECTED MODE: {mode.upper()}\n"
            f"Target overall score for this argument when judged: {spec['target_band']}.\n\n"
            f"REQUIRED BEHAVIOR FOR {mode.upper()} MODE:\n"
            f"{spec['instructions']}\n\n"
            "⸻\n\n"
            "📌 GENERAL RULES (apply to every mode):\n"
            "* Stay strictly on topic.\n"
            "* Be persuasive within the limits of the mode above, but never offensive or personal.\n"
            "* Do not repeat the opponent's argument verbatim.\n"
            f"* Defend the assigned stance: {req.stance}\n"
            "* Do not exceed the sentence/length limit given for this mode, even if you think a longer answer would be better — "
            "matching the target difficulty is more important than writing your strongest possible argument.\n"
            "* Output ONLY the final argument text (no explanations, no meta commentary, no mention of difficulty mode).\n\n"
            "⸻\n\n"
            "📜 DEBATE CONVERSATION HISTORY:\n"
            f"{history_formatted}\n"
            "⸻\n\n"
            "📥 CURRENT TURN INPUT\n"
            f"Topic: {req.topic}\n"
            f"Your Assigned Stance: {req.stance}\n"
            f"Opponent's Latest Argument: {req.opponent_args[-1] if req.opponent_args else ''}\n"
            f"Mode: {mode}\n\n"
            "⸻\n\n"
            "📤 OUTPUT:\n"
            "AI Argument:"
        )
        
        res = await asyncio.to_thread(llm.invoke, system_prompt)
        
        # Safely extract text content
        if isinstance(res.content, list):
            generated_text = "".join(part.get("text", "") if isinstance(part, dict) else str(part) for part in res.content).strip()
        else:
            generated_text = str(res.content).strip()
        
        return {"argument": generated_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -------------------------
# REAL-TIME MULTIPLAYER DEBATE ROOMS
# -------------------------
from fastapi import WebSocket, WebSocketDisconnect
import random
import string
import uuid
import time

rooms = {}  # In-memory database of active private debate rooms: roomCode -> roomInfo

def generate_room_code() -> str:
    """Generates a unique 6-character alphanumeric room code."""
    while True:
        code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if code not in rooms:
            return code

def get_room_state_json(room: dict) -> dict:
    """Helper to return a JSON-serializable representation of the room state (excluding WebSockets)."""
    return {
        "roomId": room["roomId"],
        "roomCode": room["roomCode"],
        "hostUserId": room["hostUserId"],
        "hostUsername": room["hostUsername"],
        "guestUserId": room["guestUserId"],
        "guestUsername": room["guestUsername"],
        "status": room["status"],
        "topic": room["topic"],
        "hostConfirmedTopic": room["hostConfirmedTopic"],
        "guestConfirmedTopic": room["guestConfirmedTopic"],
        "user_sides": room["user_sides"],
        "arguments": room["arguments"],
        "rounds": room["rounds"],
        "current_round": room["current_round"],
        "current_turn_userId": room["current_turn_userId"],
        "evaluation_result": room["evaluation_result"],
        "current_evaluation": room.get("current_evaluation")
    }

async def broadcast_room_state(room_code: str):
    """Sends the current room state to all connected users in the room."""
    if room_code not in rooms:
        return
    room = rooms[room_code]
    state = get_room_state_json(room)
    
    async def safe_send(user_id, ws):
        try:
            await ws.send_json({
                "type": "room_state_update",
                "room": state
            })
        except Exception as e:
            print(f"[WS] Failed to send state to user {user_id} in room {room_code}: {e}")
            
    tasks = [safe_send(user_id, ws) for user_id, ws in list(room["connections"].items())]
    if tasks:
        await asyncio.gather(*tasks)

async def check_and_start_debate(room_code: str):
    """Transition state to ACTIVE if all prerequisites are met."""
    room = rooms[room_code]
    if (
        room["status"] == "READY"
        and room["topic"].strip()
        and room["hostConfirmedTopic"]
        and room["guestConfirmedTopic"]
        and len(room["user_sides"]) == 2
        and len(set(room["user_sides"].values())) == 2
    ):
        room["topic"] = room["topic"].strip()
        room["status"] = "ACTIVE"
        room["current_round"] = 1
        # The user representing 'FOR' speaks first
        for uid, side in room["user_sides"].items():
            if side == "FOR":
                room["current_turn_userId"] = uid
                break

async def evaluate_single_argument_and_broadcast(room_code: str, user_id: str, arg_text: str):
    """Evaluates the submitted argument live using the LangGraph node functions, streaming progress over WebSocket."""
    if room_code not in rooms:
        return
    room = rooms[room_code]
    
    # WebSocket broadcast helper for evaluation events
    async def send_eval_event(event_name: str, event_data: dict):
        cur = room.get("current_evaluation")
        if cur:
            if event_name == "ddg_start":
                cur["ddg"] = {"status": "running", "detail": event_data.get("message", "")}
            elif event_name == "ddg_complete":
                cur["ddg"] = {"status": "completed", "detail": event_data.get("message", "")}
            elif event_name == "judge3_start":
                cur["judge3"]["status"] = "running"
                cur["judge3"]["reasoning"] = event_data.get("message", "")
            elif event_name == "judge3_complete":
                cur["judge3"]["status"] = "completed"
                cur["judge3"]["score"] = event_data.get("topic_score")
                cur["judge3"]["novelty"] = event_data.get("novelty_score")
                cur["judge3"]["reasoning"] = event_data.get("reasoning")[0] if isinstance(event_data.get("reasoning"), list) else event_data.get("reasoning", "")
            elif event_name == "judge1_start":
                cur["judge1"]["status"] = "running"
                cur["judge1"]["reasoning"] = event_data.get("message", "")
            elif event_name == "judge1_complete":
                cur["judge1"]["status"] = "completed"
                cur["judge1"]["score"] = event_data.get("fact_score")
                cur["judge1"]["reasoning"] = event_data.get("reasoning")[-1] if isinstance(event_data.get("reasoning"), list) else event_data.get("reasoning", "")
                cur["judge1"]["facts"] = event_data.get("retrieved_facts", "")
            elif event_name == "judge2_start":
                cur["judge2"]["status"] = "running"
                cur["judge2"]["reasoning"] = event_data.get("message", "")
            elif event_name == "judge2_complete":
                cur["judge2"]["status"] = "completed"
                cur["judge2"]["score"] = event_data.get("related_score")
                cur["judge2"]["reasoning"] = event_data.get("reasoning")[-1] if isinstance(event_data.get("reasoning"), list) else event_data.get("reasoning", "")
            elif event_name == "judge4_start":
                cur["judge4"]["status"] = "running"
                cur["judge4"]["reasoning"] = event_data.get("message", "")
            elif event_name == "judge4_complete":
                cur["judge4"]["status"] = "completed"
                cur["judge4"]["score"] = event_data.get("stance_score")
                cur["judge4"]["reasoning"] = event_data.get("reasoning")[-1] if isinstance(event_data.get("reasoning"), list) else event_data.get("reasoning", "")
            elif event_name == "judge5_start":
                cur["judge5"]["status"] = "running"
                cur["judge5"]["reasoning"] = event_data.get("message", "")
            elif event_name == "judge5_complete":
                cur["judge5"]["status"] = "completed"
                cur["judge5"]["score"] = event_data.get("delivery_score")
                cur["judge5"]["reasoning"] = event_data.get("reasoning")[-1] if isinstance(event_data.get("reasoning"), list) else event_data.get("reasoning", "")
            elif event_name == "final_result_start":
                cur["final"]["status"] = "running"
            elif event_name == "final_result":
                cur["final"]["status"] = "completed"
                cur["final"]["score"] = event_data.get("final_score")
            elif event_name in ("done", "error"):
                room["current_evaluation"] = None

        async def safe_send(uid, ws):
            try:
                await ws.send_json({
                    "type": "eval_event",
                    "event": event_name,
                    "data": event_data
                })
            except Exception as e:
                print(f"[WS] Failed to send progress update to user {uid}: {e}")
                
        tasks = [safe_send(uid, ws) for uid, ws in list(room["connections"].items())]
        if tasks:
            await asyncio.gather(*tasks)

    try:
        print(f"[WS EVAL] Initiating live turn-by-turn AI evaluation for room {room_code}, user {user_id}")
        host_id = room["hostUserId"]
        guest_id = room["guestUserId"]
        
        host_stance = room["user_sides"].get(host_id, "FOR")
        guest_stance = room["user_sides"].get(guest_id, "AGAINST")
        
        # Prepare lists of arguments for both speakers
        user1_args = [a["argumentText"] for a in room["arguments"] if a["userId"] == host_id]
        user2_args = [a["argumentText"] for a in room["arguments"] if a["userId"] == guest_id]
        
        current_user_key = "user1" if user_id == host_id else "user2"
        
        # Compute previous scores totals
        user1_total = sum(a["score"] for a in room["arguments"] if a["userId"] == host_id)
        user2_total = sum(a["score"] for a in room["arguments"] if a["userId"] == guest_id)
        
        # Setup evaluation state dictionary
        eval_state = {
            "topic": room["topic"],
            "user1_args": user1_args,
            "user2_args": user2_args,
            "user1_stance": host_stance,
            "user2_stance": guest_stance,
            "current_round": room["current_round"],
            "current_user": current_user_key,
            "current_argument": arg_text,
            "reasoning": [],
            "related_score": 0.0,
            "novelty_score": 0.0,
            "topic_score": 0.0,
            "fact_score": 0.0,
            "stance_score": 50.0,
            "delivery_score": 100.0,
            "final_score": 0.0,
            "gated": False,
            "stance_gated": False,
            "user1_total": user1_total,
            "user2_total": user2_total,
            "retrieved_facts": "",
            "raw_transcript": ""
        }
        
        # 1. Routing & Tool Execution
        print(f"[WS EVAL] Querying routing strategy for argument...")
        await send_eval_event("ddg_start", {"message": "Routing query and deciding knowledge source..."})
        
        routing = await asyncio.to_thread(decide_knowledge_source_node, eval_state)
        eval_state.update(routing)
        
        strategy = eval_state.get("knowledge_strategy", "internal")
        confidence = eval_state.get("router_confidence", 1.0)
        search_q = eval_state.get("search_query", "")
        
        strat_name = strategy.upper()
        await send_eval_event("ddg_start", {"message": f"Router decided: {strat_name} (Confidence: {confidence})"})
        
        tool_updates = {}
        actual_strategy = "internal"
        if strategy == "rag":
            if confidence < 0.5:
                await send_eval_event("ddg_start", {"message": f"RAG confidence ({confidence}) is low. Falling back to Live Web Search..."})
                tool_updates = await asyncio.to_thread(web_search_tool_node, eval_state)
                actual_strategy = "web"
            else:
                await send_eval_event("ddg_start", {"message": f"Retrieving facts from local RAG store (query: \"{search_q}\")..."})
                tool_updates = await asyncio.to_thread(rag_tool_node, eval_state)
                actual_strategy = "rag"
        elif strategy == "web":
            await send_eval_event("ddg_start", {"message": f"Querying DuckDuckGo live search (query: \"{search_q}\")..."})
            tool_updates = await asyncio.to_thread(web_search_tool_node, eval_state)
            actual_strategy = "web"
        else:
            await send_eval_event("ddg_start", {"message": "Relying on internal knowledge (no retrieval needed)"})
            actual_strategy = "internal"
            
        eval_state.update(tool_updates)
        await send_eval_event("ddg_complete", {
            "message": f"Source: {strat_name} | Query: '{search_q or 'None'}'",
            "strategy": actual_strategy
        })

        # 2. Judge 3: Topicality Auditor
        print("[WS EVAL] Executing Judge 3: Topicality Auditor...")
        await send_eval_event("judge3_start", {"message": "Judge 3 (Topicality Auditor) starting evaluation..."})
        s1 = await asyncio.to_thread(evaluate_topic_novelty_node, eval_state)
        eval_state.update(s1)
        await send_eval_event("judge3_complete", s1)
        print(f"[WS EVAL] Judge 3 complete. Topic Score: {s1.get('topic_score')}, Novelty Score: {s1.get('novelty_score')}")

        # 3. Judge 1: Logical Analyst
        print("[WS EVAL] Executing Judge 1: Logical Analyst...")
        await send_eval_event("judge1_start", {"message": "Judge 1 (Logical Analyst) starting evaluation..."})
        s2 = await asyncio.to_thread(evaluate_logic_node, eval_state)
        eval_state.update(s2)
        await send_eval_event("judge1_complete", s2)
        print(f"[WS EVAL] Judge 1 complete. Logic Score: {s2.get('fact_score')}")

        # 4. Judge 2: Rebuttal Evaluator
        print("[WS EVAL] Executing Judge 2: Rebuttal Evaluator...")
        await send_eval_event("judge2_start", {"message": "Judge 2 (Rebuttal Evaluator) starting evaluation..."})
        s3 = await asyncio.to_thread(evaluate_rebuttal_node, eval_state)
        eval_state.update(s3)
        await send_eval_event("judge2_complete", s3)
        print(f"[WS EVAL] Judge 2 complete. Rebuttal Score: {s3.get('related_score')}")

        # 5. Judge 4: Stance Auditor
        print("[WS EVAL] Executing Judge 4: Stance Auditor...")
        await send_eval_event("judge4_start", {"message": "Judge 4 (Stance Auditor) starting evaluation..."})
        s4 = await asyncio.to_thread(evaluate_stance_node, eval_state)
        eval_state.update(s4)
        await send_eval_event("judge4_complete", s4)
        print(f"[WS EVAL] Judge 4 complete. Stance Score: {s4.get('stance_score')}")

        # 6. Judge 5: Delivery Judge
        print("[WS EVAL] Executing Judge 5: Delivery Judge...")
        await send_eval_event("judge5_start", {"message": "Judge 5 (Delivery Judge) starting evaluation..."})
        s6 = await asyncio.to_thread(evaluate_delivery_node, eval_state)
        eval_state.update(s6)
        await send_eval_event("judge5_complete", s6)
        print(f"[WS EVAL] Judge 5 complete. Delivery Score: {s6.get('delivery_score')}")

        # 7. Final aggregation
        print("[WS EVAL] Compiling final scores...")
        await send_eval_event("final_result_start", {"message": "Compiling final scores and updates..."})
        s5 = await asyncio.to_thread(aggregate_scores_node, eval_state)
        eval_state.update(s5)
        print(f"[WS EVAL] Compilation complete. Final Score: {eval_state['final_score']}")
        await send_eval_event("final_result", {"final_score": eval_state["final_score"]})
        
        # Build evaluated argument entry
        evaluated_arg = {
            "userId": user_id,
            "username": room["hostUsername"] if user_id == host_id else room["guestUsername"],
            "argumentText": arg_text,
            "roundNumber": room["current_round"],
            "score": eval_state["final_score"],
            "topicScore": eval_state["topic_score"],
            "factScore": eval_state["fact_score"],
            "relatedScore": eval_state["related_score"],
            "noveltyScore": eval_state["novelty_score"],
            "stanceScore": eval_state["stance_score"],
            "deliveryScore": eval_state.get("delivery_score", 100.0),
            "reasoning": "\n".join(eval_state.get("reasoning", [])),
            "retrievedFacts": eval_state.get("retrieved_facts", "")
        }
        
        # Append evaluated argument to room arguments list
        room["arguments"].append(evaluated_arg)
        
        # Swap turns
        other_id = guest_id if user_id == host_id else host_id
        room["current_turn_userId"] = other_id
        
        # Check if round completes
        round_args = [a for a in room["arguments"] if a["roundNumber"] == room["current_round"]]
        if len(round_args) >= 2:
            room["current_round"] += 1
            # Next round first speaker matches who is FOR
            for uid, side in room["user_sides"].items():
                if side == "FOR":
                    room["current_turn_userId"] = uid
                    break
                    
            if room["current_round"] > room["rounds"]:
                host_score = sum(a["score"] for a in room["arguments"] if a["userId"] == host_id)
                guest_score = sum(a["score"] for a in room["arguments"] if a["userId"] == guest_id)
                
                if host_score > guest_score:
                    winner_id = host_id
                    winner_username = room["hostUsername"]
                elif guest_score > host_score:
                    winner_id = guest_id
                    winner_username = room["guestUsername"]
                else:
                    winner_id = "draw"
                    winner_username = "Draw"
                    
                room["evaluation_result"] = {
                    "winnerId": winner_id,
                    "winnerUsername": winner_username,
                    "hostTotalScore": host_score,
                    "guestTotalScore": guest_score,
                    "arguments": room["arguments"]
                }
                room["status"] = "COMPLETED"

        await send_eval_event("done", {})
        # Send room state update to both users
        await broadcast_room_state(room_code)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        # Clear current evaluation status
        room["current_evaluation"] = None
        # Restore current turn to the user who submitted so they can retry
        room["current_turn_userId"] = user_id
        # Notify clients of internal evaluation errors
        for uid, ws in list(room["connections"].items()):
            try:
                await ws.send_json({
                    "type": "error",
                    "message": f"AI evaluation processing error: {str(e)}"
                })
            except:
                pass
        # Broadcast the state update to reset the client-side submitting UI state
        await broadcast_room_state(room_code)


# --- REST ROOM ENDPOINTS ---

class CreateRoomRequest(BaseModel):
    hostUserId: str
    hostUsername: str
    rounds: Optional[int] = 2

@app.post("/api/rooms/create")
async def create_room(req: CreateRoomRequest):
    code = generate_room_code()
    room = {
        "roomId": str(uuid.uuid4()),
        "roomCode": code,
        "hostUserId": req.hostUserId,
        "hostUsername": req.hostUsername,
        "guestUserId": None,
        "guestUsername": None,
        "status": "WAITING",
        "topic": "",
        "hostConfirmedTopic": False,
        "guestConfirmedTopic": False,
        "user_sides": {},
        "arguments": [],
        "rounds": req.rounds if req.rounds and req.rounds in (1, 2, 3) else 2,
        "current_round": 1,
        "current_turn_userId": None,
        "connections": {},
        "evaluation_result": None,
        "current_evaluation": None
    }
    rooms[code] = room
    return get_room_state_json(room)

class JoinRoomRequest(BaseModel):
    roomCode: str
    userId: str
    username: str

@app.post("/api/rooms/join")
async def join_room(req: JoinRoomRequest):
    code = req.roomCode.upper().strip()
    if code not in rooms:
        raise HTTPException(status_code=404, detail="Room not found.")
    room = rooms[code]
    
    # Allow joining if room is WAITING, or if it is already filled by the same guest (rejoin support)
    if room["status"] != "WAITING" and room["guestUserId"] != req.userId:
        raise HTTPException(status_code=400, detail="This debate room is already full.")
        
    if room["hostUserId"] == req.userId:
        raise HTTPException(status_code=400, detail="Cannot join your own room as a guest.")
        
    room["guestUserId"] = req.userId
    room["guestUsername"] = req.username
    room["status"] = "READY"
    
    return get_room_state_json(room)


# --- WEBSOCKET ROOM COORDINATOR ---

@app.websocket("/ws/room/{roomCode}/{userId}")
async def websocket_room(websocket: WebSocket, roomCode: str, userId: str):
    code = roomCode.upper().strip()
    if code not in rooms:
        await websocket.close(code=4004, reason="Room not found")
        return
        
    room = rooms[code]

    await websocket.accept()
    room["connections"][userId] = websocket
    
    # Broadcast current room status upon initial connection
    await broadcast_room_state(code)

    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            
            if action == "set_topic":
                # Topic selection (host action only)
                if userId == room["hostUserId"] and room["status"] in ("READY", "WAITING"):
                    room["topic"] = data.get("topic", "")
                    room["hostConfirmedTopic"] = False
                    room["guestConfirmedTopic"] = False
                    await broadcast_room_state(code)
                    
            elif action == "confirm_topic":
                # Topic locking mechanism
                if room["status"] == "READY" and room["topic"].strip():
                    if userId == room["hostUserId"]:
                        room["hostConfirmedTopic"] = True
                    elif userId == room["guestUserId"]:
                        room["guestConfirmedTopic"] = True
                    
                    await check_and_start_debate(code)
                    await broadcast_room_state(code)
                    
            elif action == "choose_side":
                # Stance mapping selection (FOR / AGAINST)
                side = data.get("side")
                if side in ("FOR", "AGAINST") and room["status"] in ("READY", "WAITING"):
                    room["user_sides"][userId] = side
                    
                    # Auto-assign opposite stance to prevent conflicts
                    other_id = room["guestUserId"] if userId == room["hostUserId"] else room["hostUserId"]
                    if other_id:
                        room["user_sides"][other_id] = "AGAINST" if side == "FOR" else "FOR"
                        
                    await check_and_start_debate(code)
                    await broadcast_room_state(code)
                    
            elif action == "submit_argument":
                # Turn-based round submission
                if room["status"] == "ACTIVE" and userId == room["current_turn_userId"]:
                    arg_text = data.get("argumentText", "").strip()
                    if arg_text:
                        # Prevent duplicate submissions by clearing the turn immediately
                        room["current_turn_userId"] = None
                        room["current_evaluation"] = {
                            "ddg": { "status": "pending", "detail": "" },
                            "judge3": { "status": "pending", "score": None, "novelty": None, "reasoning": "" },
                            "judge1": { "status": "pending", "score": None, "reasoning": "", "facts": "" },
                            "judge2": { "status": "pending", "score": None, "reasoning": "" },
                            "judge4": { "status": "pending", "score": None, "reasoning": "" },
                            "judge5": { "status": "pending", "score": None, "reasoning": "" },
                            "final": { "status": "pending", "score": None }
                        }
                        
                        # Broadcast room state to immediately show the loading UI to both players
                        await broadcast_room_state(code)
                        
                        # Broadcast evaluation_started to both clients to initialize progress UI
                        async def send_eval_start(uid, ws):
                            try:
                                await ws.send_json({
                                    "type": "evaluation_started",
                                    "message": "AI Judges are deliberating. Live scoring..."
                                })
                            except Exception as e:
                                print(f"[WS] Failed to send eval_started to user {uid}: {e}")
                        
                        tasks = [send_eval_start(uid, ws) for uid, ws in list(room["connections"].items())]
                        if tasks:
                            await asyncio.gather(*tasks)

                        # Launch live evaluation task in background to keep WS listening responsive
                        asyncio.create_task(evaluate_single_argument_and_broadcast(code, userId, arg_text))
                        
    except WebSocketDisconnect:
        # Gracefully handle client disconnect
        if userId in room["connections"]:
            del room["connections"][userId]
        await broadcast_room_state(code)
    except Exception as e:
        print(f"[WS] Exception handling user {userId} in room {code}: {e}")
        if userId in room["connections"]:
            del room["connections"][userId]


# -------------------------
# RUN SERVER
# -------------------------
if __name__ == "__main__":
    # Start the server on port 8000
    uvicorn.run(app, host="127.0.0.1", port=8000)
