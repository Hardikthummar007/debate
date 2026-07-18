from ai_evaluator.graphs import cli_workflow as workflow

def play():
    topic = input("Enter debate topic: ")

    while True:
        choice = input("User1 — pick your stance (FOR / AGAINST): ").strip().upper()
        if choice in ("FOR", "AGAINST"):
            user1_stance = choice
            break
        print("Please type 'FOR' or 'AGAINST'.")

    user2_stance = "AGAINST" if user1_stance == "FOR" else "FOR"
    print(f"User1 is arguing {user1_stance}. User2 is arguing {user2_stance}.\n")

    initial_state = {
        "topic": topic,
        "user1_args": [],
        "user2_args": [],
        "user1_stance": user1_stance,
        "user2_stance": user2_stance,
        "current_round": 1,
        "current_user": "user1",
        "current_argument": "",
        "reasoning": [],
        "related_score": 0.0,
        "novelty_score": 0.0,
        "topic_score": 0.0,
        "fact_score": 0.0,
        "stance_score": 0.0,
        "final_score": 0.0,
        "gated": False,
        "stance_gated": False,
        "user1_total": 0.0,
        "user2_total": 0.0,
        "retrieved_facts": ""
    }

    workflow.invoke(initial_state)


if __name__ == "__main__":
    play()