"use strict";

(() => {
    const storageKey = "jacob-vroman-games-coins-v1";
    const countElement = document.querySelector("[data-coin-count]");
    const statusElement = document.querySelector("[data-coin-storage-status]");
    let coinCount = 0;
    let storageReady = false;

    if (!countElement || !statusElement) {
        throw new Error("The coin wallet requires its count and status elements.");
    }

    function parseCoinCount(value) {
        const parsed = value === null ? 0 : Number(value);
        if (!Number.isSafeInteger(parsed) || parsed < 0) {
            throw new Error("The saved coin count is invalid.");
        }
        return parsed;
    }

    function showStorageError(error) {
        storageReady = false;
        countElement.textContent = "—";
        statusElement.textContent = "Coin storage is unavailable. Your total could not be loaded or saved.";
        statusElement.hidden = false;
        console.error("Could not access the saved coin total.", error);
    }

    function render() {
        countElement.textContent = String(coinCount);
        statusElement.hidden = true;
        statusElement.textContent = "";
    }

    try {
        coinCount = parseCoinCount(window.localStorage.getItem(storageKey));
        storageReady = true;
        render();
    } catch (error) {
        showStorageError(error);
    }

    function awardWin() {
        if (!storageReady) {
            return false;
        }

        const updatedCount = coinCount + 1;
        if (!Number.isSafeInteger(updatedCount)) {
            showStorageError(new Error("The coin total is too large to store safely."));
            return false;
        }

        try {
            window.localStorage.setItem(storageKey, String(updatedCount));
        } catch (error) {
            showStorageError(error);
            return false;
        }

        coinCount = updatedCount;
        render();
        return true;
    }

    function chargeLoss() {
        if (!storageReady) {
            return "unavailable";
        }
        if (coinCount === 0) {
            return "empty";
        }

        const updatedCount = coinCount - 1;
        try {
            window.localStorage.setItem(storageKey, String(updatedCount));
        } catch (error) {
            showStorageError(error);
            return "unavailable";
        }

        coinCount = updatedCount;
        render();
        return "removed";
    }

    window.addEventListener("storage", (event) => {
        if (event.key !== storageKey && event.key !== null) {
            return;
        }

        try {
            coinCount = parseCoinCount(event.key === null ? null : event.newValue);
            storageReady = true;
            render();
        } catch (error) {
            showStorageError(error);
        }
    });

    window.gameCoinWallet = Object.freeze({ awardWin, chargeLoss });
})();
