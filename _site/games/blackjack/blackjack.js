"use strict";

const suits = ["clubs", "diamonds", "hearts", "spades"];
const ranks = ["02", "03", "04", "05", "06", "07", "08", "09", "10", "J", "Q", "K", "A"];
const cardBack = "images/cards/card_back.png";
const soundCollections = {
    slide: [
        "card-slide-1.ogg",
        "card-slide-2.ogg",
        "card-slide-3.ogg",
        "card-slide-4.ogg",
        "card-slide-5.ogg",
        "card-slide-6.ogg",
        "card-slide-7.ogg",
        "card-slide-8.ogg",
    ],
    place: [
        "card-place-1.ogg",
        "card-place-2.ogg",
        "card-place-3.ogg",
        "card-place-4.ogg",
    ],
    shuffle: ["card-shuffle.ogg"],
};
const visibleDeckSize = 6;

const dealerCardsElement = document.getElementById("dealer-cards");
const playerCardsElement = document.getElementById("player-cards");
const deckStackElement = document.getElementById("deck-stack");
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
let isAnimating = false;
let dealerRevealed = true;
let activeCardDrag = null;

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

function makeDeckBack() {
    const image = makeCardImage(cardBack, "");
    image.setAttribute("aria-hidden", "true");
    return image;
}

function initializeDeckStack() {
    for (let index = 0; index < visibleDeckSize; index += 1) {
        deckStackElement.append(makeDeckBack());
    }
}

function playRandomSound(collection) {
    const sounds = soundCollections[collection];
    const sound = sounds[Math.floor(Math.random() * sounds.length)];
    const audio = new Audio(`audio/${sound}`);
    audio.volume = 0.35;
    audio.play().catch((error) => {
        console.warn(`Unable to play the ${collection} card sound.`, error);
    });
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

function cancelActiveCardDrag() {
    if (!activeCardDrag) {
        return;
    }

    const drag = activeCardDrag;
    activeCardDrag = null;
    stopCardDrag(drag);
    drag.original.style.visibility = drag.originalVisibility;
    drag.overlay.remove();
}

function stopCardDrag(drag) {
    document.removeEventListener("pointermove", moveDraggedCard);
    document.removeEventListener("pointerup", releaseDraggedCard);
    document.removeEventListener("pointercancel", releaseDraggedCard);
    cancelAnimationFrame(drag.frameId);
}

function updateDraggedCard(drag) {
    drag.overlay.style.left = `${drag.x}px`;
    drag.overlay.style.top = `${drag.y}px`;
    drag.overlay.style.transform = `rotate(${drag.angle}deg)`;
}

function animateDraggedCard(timestamp) {
    const drag = activeCardDrag;
    if (!drag) {
        return;
    }

    const elapsed = Math.min((timestamp - drag.lastFrameTime) / 1000, 0.032);
    drag.lastFrameTime = timestamp;

    if (drag.dragging && timestamp - drag.lastMoveTime > 80) {
        drag.targetAngle = 0;
    }

    const angularAcceleration = (drag.targetAngle - drag.angle) * 110 - drag.angularVelocity * 19;
    drag.angularVelocity += angularAcceleration * elapsed;
    drag.angle += drag.angularVelocity * elapsed;

    if (!drag.dragging) {
        const horizontalAcceleration = (drag.originX - drag.x) * 90 - drag.velocityX * 19;
        const verticalAcceleration = (drag.originY - drag.y) * 90 - drag.velocityY * 19;
        drag.velocityX += horizontalAcceleration * elapsed;
        drag.velocityY += verticalAcceleration * elapsed;
        drag.x += drag.velocityX * elapsed;
        drag.y += drag.velocityY * elapsed;
    }

    updateDraggedCard(drag);

    const settled = Math.abs(drag.originX - drag.x) < 0.5 &&
        Math.abs(drag.originY - drag.y) < 0.5 &&
        Math.abs(drag.velocityX) < 5 &&
        Math.abs(drag.velocityY) < 5 &&
        Math.abs(drag.angle) < 0.2 &&
        Math.abs(drag.angularVelocity) < 1;
    if (!drag.dragging && settled) {
        cancelActiveCardDrag();
        return;
    }

    drag.frameId = requestAnimationFrame(animateDraggedCard);
}

function moveDraggedCard(event) {
    const drag = activeCardDrag;
    if (!drag || !drag.dragging || event.pointerId !== drag.pointerId) {
        return;
    }

    event.preventDefault();
    const now = performance.now();
    const elapsed = Math.max(now - drag.lastPointerTime, 1);
    drag.velocityX = Math.max(-1800, Math.min(1800, ((event.clientX - drag.lastPointerX) / elapsed) * 1000));
    drag.velocityY = Math.max(-1800, Math.min(1800, ((event.clientY - drag.lastPointerY) / elapsed) * 1000));
    drag.targetAngle = Math.max(-30, Math.min(30, drag.velocityX * 0.018 + drag.velocityY * 0.006));
    drag.lastPointerX = event.clientX;
    drag.lastPointerY = event.clientY;
    drag.lastPointerTime = now;
    drag.lastMoveTime = now;
    drag.x = event.clientX - drag.grabX;
    drag.y = event.clientY - drag.grabY;
    updateDraggedCard(drag);
}

function releaseDraggedCard(event) {
    const drag = activeCardDrag;
    if (!drag || event.pointerId !== drag.pointerId) {
        return;
    }

    if (event.type === "pointerup") {
        moveDraggedCard(event);
    }
    drag.dragging = false;
    drag.targetAngle = 0;
    document.removeEventListener("pointermove", moveDraggedCard);
    document.removeEventListener("pointerup", releaseDraggedCard);
    document.removeEventListener("pointercancel", releaseDraggedCard);

    if (drag.reducedMotion) {
        cancelActiveCardDrag();
        return;
    }
    drag.frameId = requestAnimationFrame(animateDraggedCard);
}

function startDraggingCard(event) {
    if (event.button !== 0 || event.isPrimary === false || !(event.target instanceof HTMLImageElement)) {
        return;
    }

    cancelActiveCardDrag();
    event.preventDefault();

    const original = event.target;
    const bounds = original.getBoundingClientRect();
    const overlay = original.cloneNode();
    overlay.className = "card-dragging";
    overlay.alt = "";
    overlay.draggable = false;
    overlay.setAttribute("aria-hidden", "true");

    const grabX = event.clientX - bounds.left;
    const grabY = event.clientY - bounds.top;
    const now = performance.now();
    const reducedMotion = window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    activeCardDrag = {
        original,
        originalVisibility: original.style.visibility,
        overlay,
        pointerId: event.pointerId,
        grabX,
        grabY,
        originX: bounds.left,
        originY: bounds.top,
        width: bounds.width,
        height: bounds.height,
        x: bounds.left,
        y: bounds.top,
        velocityX: 0,
        velocityY: 0,
        angle: 0,
        angularVelocity: 0,
        targetAngle: 0,
        dragging: true,
        reducedMotion,
        lastPointerX: event.clientX,
        lastPointerY: event.clientY,
        lastPointerTime: now,
        lastMoveTime: now,
        lastFrameTime: now,
        frameId: 0,
    };

    overlay.style.left = `${bounds.left}px`;
    overlay.style.top = `${bounds.top}px`;
    overlay.style.width = `${bounds.width}px`;
    overlay.style.height = `${bounds.height}px`;
    overlay.style.transformOrigin = `${grabX}px ${grabY}px`;
    document.body.append(overlay);
    original.style.visibility = "hidden";

    document.addEventListener("pointermove", moveDraggedCard);
    document.addEventListener("pointerup", releaseDraggedCard);
    document.addEventListener("pointercancel", releaseDraggedCard);
    activeCardDrag.frameId = requestAnimationFrame(animateDraggedCard);
}

function startDraggingDeckCard(event) {
    if (event.target === deckStackElement.lastElementChild) {
        startDraggingCard(event);
    }
}

async function animateCard(image) {
    const deckTopCard = deckStackElement.lastElementChild;
    if (!deckTopCard) {
        return;
    }

    const heldDeckDrag = activeCardDrag &&
        activeCardDrag.dragging &&
        activeCardDrag.original === deckTopCard
        ? activeCardDrag
        : null;
    if (activeCardDrag && activeCardDrag !== heldDeckDrag) {
        cancelActiveCardDrag();
    }

    const source = heldDeckDrag
        ? {
            left: heldDeckDrag.x,
            top: heldDeckDrag.y,
            width: heldDeckDrag.width,
            height: heldDeckDrag.height,
        }
        : deckTopCard.getBoundingClientRect();
    const target = image.getBoundingClientRect();
    const flight = heldDeckDrag ? heldDeckDrag.overlay : deckTopCard;
    flight.src = image.src;
    deckTopCard.remove();
    deckStackElement.append(makeDeckBack());

    if (heldDeckDrag) {
        activeCardDrag = null;
        stopCardDrag(heldDeckDrag);
        flight.classList.remove("card-dragging");
    }

    const reducedMotion = window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (typeof image.animate !== "function" || reducedMotion) {
        if (heldDeckDrag) {
            flight.remove();
        }
        return;
    }

    flight.classList.add("dealing-card");
    flight.style.left = `${source.left}px`;
    flight.style.top = `${source.top}px`;
    flight.style.width = `${source.width}px`;
    flight.style.height = `${source.height}px`;
    if (!heldDeckDrag) {
        flight.style.transformOrigin = "center";
        document.body.append(flight);
    }
    image.style.visibility = "hidden";
    playRandomSound("slide");

    const horizontalDistance = target.left + target.width / 2 - source.left - source.width / 2;
    const verticalDistance = target.top + target.height / 2 - source.top - source.height / 2;
    const scale = target.width / source.width;
    const startingTransform = heldDeckDrag
        ? `rotate(${heldDeckDrag.angle}deg)`
        : "translate(0, 0) scale(1) rotate(0deg)";
    const rotation = heldDeckDrag ? 0 : (Math.random() * 6) - 3;
    const animation = flight.animate(
        [
            { transform: startingTransform },
            { transform: `translate(${horizontalDistance}px, ${verticalDistance}px) scale(${scale}) rotate(${rotation}deg)` },
        ],
        { duration: 420, easing: "cubic-bezier(0.2, 0.7, 0.25, 1)" }
    );

    await animation.finished;
    flight.remove();
    image.style.visibility = "";
}

async function dealCardToHand(hand, container) {
    hand.push(drawCard());
    render();
    const image = container.lastElementChild;
    await animateCard(image);
    //playRandomSound("place");
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

    hitButton.disabled = !handInProgress || isAnimating;
    standButton.disabled = !handInProgress || isAnimating;
    dealButton.disabled = handInProgress || isAnimating;
    dealButton.textContent = playerHand.length === 0 ? "Deal" : "Play again";
}

function setMessage(text) {
    messageElement.textContent = text;
}

function finishRound(result, outcome) {
    handInProgress = false;
    isAnimating = false;
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

async function dealerTurn() {
    dealerRevealed = true;
    isAnimating = true;
    render();
    while (handValue(dealerHand) < 17) {
        await dealCardToHand(dealerHand, dealerCardsElement);
    }
    isAnimating = false;
    resolveRound();
}

async function deal() {
    if (handInProgress) {
        return;
    }
    const holdingDeckTop = activeCardDrag &&
        activeCardDrag.dragging &&
        activeCardDrag.original === deckStackElement.lastElementChild;
    if (!holdingDeckTop) {
        cancelActiveCardDrag();
    }

    deck = createDeck();
    playerHand = [];
    dealerHand = [];
    handInProgress = true;
    isAnimating = true;
    dealerRevealed = false;
    render();

    await dealCardToHand(playerHand, playerCardsElement);
    await dealCardToHand(dealerHand, dealerCardsElement);
    await dealCardToHand(playerHand, playerCardsElement);
    await dealCardToHand(dealerHand, dealerCardsElement);

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
        isAnimating = false;
        setMessage("Your move: hit or stand.");
        render();
    }
}

async function hit() {
    if (!handInProgress) {
        return;
    }
    isAnimating = true;
    await dealCardToHand(playerHand, playerCardsElement);
    if (handValue(playerHand) > 21) {
        dealerRevealed = true;
        resolveRound();
    } else if (handValue(playerHand) === 21) {
        await dealerTurn();
    } else {
        isAnimating = false;
        setMessage("Your move: hit or stand.");
        render();
    }
}

function stand() {
    if (handInProgress) {
        void dealerTurn();
    }
}

initializeDeckStack();
deckStackElement.addEventListener("pointerdown", startDraggingDeckCard);
dealerCardsElement.addEventListener("pointerdown", startDraggingCard);
playerCardsElement.addEventListener("pointerdown", startDraggingCard);
dealButton.addEventListener("click", deal);
hitButton.addEventListener("click", hit);
standButton.addEventListener("click", stand);

render();
