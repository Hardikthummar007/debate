# Game of Thorne Arena: Champion's Guide to Side Features

Welcome, Champion of the Realm. The Game of Thorne Arena is not merely a platform for debate; it is an immersive, game-themed battlefield where logic, rhetoric, and strategy decide who commands the Iron Throne of Eloquence. 

Below is the complete blueprint of all the side features that govern this medieval realm, consolidated into a single document.

---

## 1. Character Equipping & Sigils
Your character avatar represents your House and faction in the debate arena. It is your visual identity on the leaderboard and in active battles.

*   **Avatars Available**:
    *   **Knight**: The default champion (Stark sigil alignment).
    *   **Assassin**: A shadow operator (Martell sigil alignment).
    *   **Queen**: Royal lineage (Targaryen sigil alignment).
    *   **Strategist**: Master tactician (Greyjoy sigil alignment).
    *   **Dragonlord**: Ruler of sky and fire (Lannister sigil alignment).
*   **Sigil Bindings**:
    When you equip an avatar, your sigil updates automatically across the interface (top navigation bar, match pages, profile page). The mapping translates to:
    *   `stark` / `knight` $\rightarrow$ **House Stark** (Direwolf sigil)
    *   `lannister` / `dragonlord` $\rightarrow$ **House Lannister** (Golden Lion sigil)
    *   `targaryen` / `queen` $\rightarrow$ **House Targaryen** (Three-Headed Dragon sigil)
    *   `greyjoy` / `strategist` $\rightarrow$ **House Greyjoy** (Golden Kraken sigil)
    *   *Default / Others* $\rightarrow$ **House Martell** (Sun and Spear sigil)
*   **Equipping**:
    Champions can select and instantly equip unlocked avatars from the **Court** tab of the dashboard. Once selected, your sigil is refreshed in real-time in the global sticky `<TopNav />` header.

---

## 2. Citadel Leaderboard & Elo Rating
The Citadel maintains a record of every battle fought across the realm. Ranking is dictated by ELO and victory statistics.

*   **Elo Rating (Elo)**:
    *   Every champion begins their journey with a baseline rating of **1000 Elo**.
    *   After each battle, Elo gains or losses are calculated dynamically using expected score probabilities:
        $$\text{Expected Score} = \frac{1}{1 + 10^{\frac{\text{Opponent Rating} - \text{Your Rating}}{400}}}$$
    *   A victory over a higher-ranked opponent yields a substantial Elo boost, while defeats to lower-ranked opponents will severely drain your Elo.
*   **Trophy Metrics**:
    *   **Gold Coins (G)**: Spoils of war. Used in the Treasure Shop to unlock locked avatars and custom dashboard visual themes.
    *   **Triumphs (Wins)** & **Exiles (Losses)**: Tracks the raw total of victories and defeats.
    *   **Winning Streak (Streak)**: Tracks consecutive victories. A high streak increases your renown and is displayed as a burning flame (`🔥 Hot Streak`) in your Citadel notifications.

---

## 3. The Treasure Shop
Gold coins earned from arena victories can be taken to the **Treasure Shop** to customize your profile and interface.

*   **Avatar Purchases**:
    Locked premium avatars (such as the *Dragonlord* or *Queen*) can be purchased for **100 Gold Coins** each. Unlocking an avatar adds it permanently to your Court selection panel.
*   **Visual Themes**:
    Purchase and unlock custom visual style systems that repaint the dashboard in the colors of the Great Houses:
    *   **King's Landing Theme (Gold/Bronze)**: The default royal aesthetic.
    *   **Fire & Dragons Theme (Red/Charcoal)**: Ember and ash styling.
    *   **The North Theme (Ice/Deep Blue)**: Frost, mist, and deep arctic colors.
    *   **The Long Night Theme (Deep Shadows)**: Obsidian highlights and dark night mode.

---

## 4. House Profile Settings
The House Settings panel (`/profile`) allows you to manage your credentials and configure custom sigils.

*   **Champion Credentials**: Update your public username and raven (email) settings.
*   **Custom Avatar URL**: For players who wish to fly their own customized banner, paste a URL to a custom image avatar. This overrides the default House illustration in the navigation bar and leaderboard.
*   **House Secret (Password)**: Allows champions to secure their sigils and account records under a new password.

---

## 5. AI Opponent Difficulty Modes
When entering the arena in **Instant Match (vs AI)** mode, you can select the difficulty level of the AI opponent. This configures the LLM's debate strategy:

*   **Easy**:
    *   Target score band: *30-50 out of 100*.
    *   AI writes short, simple arguments (1-2 sentences) containing mild repetitions or logical gaps. It uses loose phrasing and is designed to be easily beaten.
*   **Medium**:
    *   Target score band: *50-70 out of 100*.
    *   AI writes average arguments (3-5 sentences) with generic reasoning. It acknowledges your arguments but does not build airtight rebuttals or offensive counter-attacks.
*   **Hard**:
    *   Target score band: *85-100 out of 100*.
    *   AI debates like a seasoned master. It writes structured arguments (5-8 sentences) following a strict flow: *Claim $\rightarrow$ Evidence $\rightarrow$ Rebuttal $\rightarrow$ Counter-attack*. It cites concrete facts, directly names and addresses weaknesses in your argument, and pre-empts your comebacks.

---

## 6. Jury Evaluation & RAG Pipeline
Every argument submitted in the arena goes through the **Citadel Jury Chamber**, a stateless LangGraph pipeline that streams evaluation progress in real-time.

*   **Step 1: Web Query Generation**: An LLM converts the debate topic into a concise, neutral search query optimized to retrieve research papers, statistics, and reports.
*   **Step 2: Routing**: A Router LLM analyzes the query and the argument and chooses the best source strategy:
    *   `RAG`: Retrieves verified local facts from the vector store index.
    *   `Web`: Performs a live DuckDuckGo query to retrieve recent news and statistics.
    *   `Internal`: Relies on internal LLM knowledge (for non-factual or philosophical arguments).
*   **Step 3: Five-Judge Panel**:
    *   **Judge I (Logic & Facts)**: Evaluates logical consistency, fallacies, and checks claims against retrieved RAG context.
    *   **Judge II (Rebuttal Quality)**: Analyzes how directly and effectively the speaker countered the opponent's previous points.
    *   **Judge III (Topicality & Novelty)**: Audits if the argument is on-topic and if it introduces new arguments instead of repeating previous rounds.
    *   **Judge IV (Stance Consistency)**: Ensures the speaker is consistently arguing their assigned side (`FOR` or `AGAINST`).
    *   **Judge V (Delivery & Eloquence)**: Grades grammar, flow, spelling, and rhetorical structure.
*   **Step 4: Gated Aggregation**:
    *   The scores are combined into a final score (out of 100).
    *   **Stance/Topicality Gates**: If Stance or Topicality score falls below **40**, the final round score is hard-capped at **30** regardless of style or logic (an off-topic argument cannot win a debate).
