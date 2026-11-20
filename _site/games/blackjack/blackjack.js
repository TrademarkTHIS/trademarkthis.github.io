"use strict";

const suits = ["clubs", "diamonds", "hearts", "spades"];
const ranks = ["02", "03", "04", "05", "06", "07", "08", "09", "10", "J", "Q", "K", "A"];
const cardBack = "images/cards/card_back.png";

const dealerCardsElement = document.getElementById("dealer-cards");
const playerCardsElement = document.getElementById("player-cards");
const dealerScoreElement = document.getElementById("dealer-score");
const playerScoreElement = document.getElementById("player-score");
const messageElement = document.getElementById("message");
const dealButton = document.getElementById("deal-button");
const hitButton = document.getElementById("hit-button");
const standButton = document.getElementById("stand-button");

let deck = [];
let playerHand = [];
let dealerHand = [];
let handInProgress = false;
let dealerRevealed = true;

function createDeck() {
    const cards = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            cards.push({ suit, rank });
        }
    }

    for (let index = cards.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
    }
    return cards;
}

function drawCard() {
    if (deck.length === 0) {
        throw new Error("The deck is empty.");
    }
    return deck.pop();
}

function cardValue(card) {
    if (card.rank === "A") {
        return 11;
    }
    if (["J", "Q", "K"].includes(card.rank)) {
        return 10;
    }
    return Number(card.rank);
}

function handValue(hand) {
    let total = hand.reduce((sum, card) => sum + cardValue(card), 0);
    let aces = hand.filter((card) => card.rank === "A").length;
    while (total > 21 && aces > 0) {
        total -= 10;
        aces -= 1;
    }
    return total;
}

function cardPath(card) {
    return `images/cards/card_${card.suit}_${card.rank}.png`;
}

function makeCardImage(src, alt) {
    const image = document.createElement("img");
    image.src = src;
    image.alt = alt;
    image.width = 64;
    image.height = 64;
    image.loading = "eager";
    return image;
}

function renderHand(container, hand, hideHoleCard) {
    while (container.children.length > hand.length) {
        container.removeChild(container.lastElementChild);
    }

    hand.forEach((card, index) => {
        const hidden = hideHoleCard && index === 1;
        const src = hidden ? cardBack : cardPath(card);
        const alt = hidden ? "Face-down card" : `${card.rank} of ${card.suit}`;
        let image = container.children[index];

        if (!image) {
            image = makeCardImage(src, alt);
            container.append(image);
        } else {
            if (image.getAttribute("src") !== src) {
                image.src = src;
            }
            if (image.alt !== alt) {
                image.alt = alt;
            }
        }
    });
}

function render() {
    renderHand(dealerCardsElement, dealerHand, !dealerRevealed);
    renderHand(playerCardsElement, playerHand, false);

    dealerScoreElement.textContent = dealerHand.length === 0
        ? ""
        : dealerRevealed
            ? `(${handValue(dealerHand)})`
            : `(${cardValue(dealerHand[0])} + ?)`;
    playerScoreElement.textContent = playerHand.length === 0 ? "" : `(${handValue(playerHand)})`;

    hitButton.disabled = !handInProgress;
    standButton.disabled = !handInProgress;
    dealButton.disabled = handInProgress;
    dealButton.textContent = playerHand.length === 0 ? "Deal" : "Play again";
}

function setMessage(text) {
    messageElement.textContent = text;
}

function finishRound(result, outcome) {
    handInProgress = false;
    dealerRevealed = true;
    if (outcome === "win") {
        const coinAwarded = window.gameCoinWallet.awardWin();
        setMessage(coinAwarded ? `${result} You earned 1 coin!` : `${result} Your coin could not be saved.`);
    } else if (outcome === "loss") {
        const coinResult = window.gameCoinWallet.chargeLoss();
        if (coinResult === "removed") {
            setMessage(`${result} You lost 1 coin.`);
        } else if (coinResult === "empty") {
            setMessage(`${result} You have no coins to lose.`);
        } else {
            setMessage(`${result} Your coin total could not be updated.`);
        }
    } else {
        setMessage(result);
    }
    render();
}

function resolveRound() {
    const playerTotal = handValue(playerHand);
    const dealerTotal = handValue(dealerHand);

    if (playerTotal > 21) {
        finishRound("Bust! Dealer wins. You lose this hand.", "loss");
    } else if (dealerTotal > 21) {
        finishRound("Dealer busts. You win!", "win");
    } else if (playerTotal > dealerTotal) {
        finishRound("You win!", "win");
    } else if (playerTotal < dealerTotal) {
        finishRound("Dealer wins. You lose this hand.", "loss");
    } else {
        finishRound("Push. No coin change this hand.", "push");
    }
}

function dealerTurn() {
    dealerRevealed = true;
    while (handValue(dealerHand) < 17) {
        dealerHand.push(drawCard());
    }
    resolveRound();
}

function deal() {
    if (handInProgress) {
        return;
    }

    deck = createDeck();
    playerHand = [];
    dealerHand = [];
    handInProgress = true;
    dealerRevealed = false;

    playerHand.push(drawCard(), drawCard());
    dealerHand.push(drawCard(), drawCard());

    const playerNatural = handValue(playerHand) === 21;
    const dealerNatural = handValue(dealerHand) === 21;

    if (playerNatural && dealerNatural) {
        dealerRevealed = true;
        finishRound("Both have blackjack. Push; no coin change.", "push");
    } else if (playerNatural) {
        dealerRevealed = true;
        finishRound("Blackjack! You win.", "win");
    } else if (dealerNatural) {
        dealerRevealed = true;
        finishRound("Dealer has blackjack. You lose this hand.", "loss");
    } else {
        setMessage("Your move: hit or stand.");
        render();
    }
}

function hit() {
    if (!handInProgress) {
        return;
    }
    playerHand.push(drawCard());
    if (handValue(playerHand) > 21) {
        dealerRevealed = true;
        resolveRound();
    } else if (handValue(playerHand) === 21) {
        dealerTurn();
    } else {
        setMessage("Your move: hit or stand.");
        render();
    }
}

function stand() {
    if (handInProgress) {
        dealerTurn();
    }
}

dealButton.addEventListener("click", deal);
hitButton.addEventListener("click", hit);
standButton.addEventListener("click", stand);

render();
