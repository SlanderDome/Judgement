Judgement Online — Game Concept & Rules

A private, browser-based multiplayer version of the Judgement card game designed for playing with friends remotely. Players join a room using a code/link. One player is the Administrator, who can start/end the game and manage the room.

Game Setup

Players have a unique Player ID within the room.

The Administrator is initially the player who creates the room.

When the game starts, all currently joined players are locked into the initial player order.

The server randomly determines the starting order.

The player order rotates every round.

The player who starts the bidding also plays the first card of that round.

After the first trick, whoever wins the trick leads the next trick.


Cards and Trump

A standard 52-card deck is used.

Card ranking:

A > K > Q > J > 10 > 9 > ... > 2

Trump follows a fixed rotation:

♠ Spades → ♦ Diamonds → ♣ Clubs → ♥ Hearts → repeat

Trump is determined by the round number and continues rotating regardless of players joining/leaving or the game changing from ascending to descending.

Round Structure

The number of cards starts at 1 and normally increases by 1 each round.

The maximum possible cards per player is:

floor(52 ÷ number of active players)

The game has an ascending phase and a descending phase.

During the ascending phase, the game attempts to increase the number of cards by 1 each round.

At the end of every round, the server checks the number of players who will be active in the next round.

If the next ascending round is possible with the new number of active players, the game continues ascending.

If it is not possible, the ascending phase is permanently locked and the game switches to descending. The next round starts at the maximum number of cards possible with the new number of active players, then decreases by 1 each round until reaching 1.

Once descending begins, it never switches back to ascending.

Example:

With 3 active players, the maximum is 17. If the game reaches 16 cards and another player is joining for the next round, there are now 4 active players, whose maximum is 13. Since 17 is impossible, the game switches to descending and the next round is 13 cards.

Bidding

Bids are public, not hidden.

The bidding order follows the same rotating player order as the round.

For example:

Round 1: A → B → C

Round 2: B → C → A

Round 3: C → A → B

The first player bids first. Each following player can see all previous bids.

The total of all bids cannot equal the number of tricks available in the round.

The final bidder therefore cannot choose a bid that makes:

Total bids = number of tricks

Example for a 1-trick round:

A bids 0.

B bids 1.

C cannot bid 0 because:

0 + 1 + 0 = 1

which equals the number of tricks.

C must choose a different legal bid, such as 1.

Playing Tricks

The player who started bidding leads the first trick.

Players must follow the suit that was led if they have that suit.

If they do not have the led suit, they may play another suit.

A trump card beats any non-trump card.

If multiple trump cards are played, the highest trump wins.

If no trump is played, the highest card of the led suit wins.

The winner of each trick leads the next trick.

Scoring

A player must win exactly the number of tricks they bid to score.

If the bid is greater than 0:

Score = bid × 10

Examples:

Bid 1, win 1 = 10 points.

Bid 3, win 3 = 30 points.

If the player fails to match their bid:

Score = 0

Special rule:

Bid 0 and win 0 = 10 points.

Player Joining

Players can join an existing room while a game is in progress.

A player joining during a round does not participate in that round. They become a waiting player and can join from the next round.

Their score starts at 0.

The number of active players is checked after every round to determine the rules for the next round.

A player joining does not retroactively receive points for previous rounds.

The game's player identities remain persistent through their Player IDs.

Player Leaving

If a player leaves, they become inactive.

They receive 0 points for every round they miss.

They are removed from the active player rotation from the next round.

Their Player ID, previous score and original position/order are retained by the room.

If they return while the room still exists, they can rejoin the game from the next round and continue with their previous score.

They do not receive points for rounds they missed.

If a new player joins, they are added to the current player order as a new player.

Internet/Connection Issues

A temporary internet problem does not immediately remove a player from the game.

Every player gets 20 seconds to perform their action.

If a player does not act within 20 seconds, the server automatically performs an action for them.

During bidding, the server selects the lowest legal bid.

During card play, the server automatically plays a legal card, preferably the lowest-risk card available.

The player's hand remains consistent because an automatic action still plays exactly one card.

If the player reconnects, they regain control from the current game state.

If they remain disconnected, automatic play continues for their turns.

A disconnected player is not automatically given 0 points merely because of the connection issue; their final score is based on the tricks they actually win through normal or automatic play.

If they intentionally leave the game, they become inactive and receive 0 points for missed rounds.

Administrator

Each room has one Administrator.

The Administrator can:

Start the game

End/dismiss the room

Remove players

Start a rematch


The Administrator has no gameplay advantage.

If the Administrator leaves, the role transfers to another active player.

Round Transition

A round is never modified after it has started.

At the end of every round:

1. Scores are calculated.


2. Player statuses are checked.


3. The active players for the next round are locked.


4. The number of active players determines the maximum possible cards.


5. The ascending/descending rule determines the next card count.


6. The next trump is determined by the continuous trump rotation.


7. The starting player is determined from the active player order.


8. The next round begins.



Players who join after the next-round player list has been locked wait until the following round.

The room remains available until it is dismissed or expires after being abandoned, allowing previously registered players to reconnect using their existing Player ID.