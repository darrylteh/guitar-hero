/**
 * Inside this file you will use the classes and functions from rx.js
 * to add visuals to the svg element in index.html, animate them, and make them interactive.
 *
 * Study and complete the tasks in observable exercises first to get ideas.
 *
 * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
 *
 * You will be marked on your functional programming style
 * as well as the functionality that you implement.
 *
 * Document your code!
 */

import "./style.css";

import {
    fromEvent,
    interval,
    merge,
    from,
    of,
    Observable,
    Subscription,
    timer,
    switchMap,
    startWith,
} from "rxjs";
import { map, filter, scan, mergeMap, delay } from "rxjs/operators";
import * as Tone from "tone";
import { ColumnKey, Key, State, Constants, Action, Note, Event } from "./types";
import {
    initialState,
    PressKey,
    Tick,
    reduceState,
    CreateCircle,
    CreateBgCircle,
    ReleaseKey,
    HoldKey,
    EndGame,
} from "./state";
import { updateView, resetCanvas } from "./view";
import { samples, parseCsvToNoteData, stopAllTailNotes } from "./util";

/**
 * This is the function called on page load. Your main game loop
 * should be called here.
 */
export function main(csvContents: string) {
    /** User input */

    // Function to create an observable for key events
    const key$ = (e: Event, k: ColumnKey | Key) =>
        fromEvent<KeyboardEvent>(document, e).pipe(
            filter(({ code }) => code === k),
            filter(({ repeat }) => !repeat),
        );

    // Higher-order function to create a mergeMap operator for key events
    const fromKey = (e: Event) => (f: (k: ColumnKey) => Action) =>
        mergeMap((k: ColumnKey) => key$(e, k).pipe(map(() => f(k))));

    const keys: ColumnKey[] = ["KeyH", "KeyJ", "KeyK", "KeyL"];

    const fromKeyDown = fromKey("keydown");

    // Creates streams for user pressing, holding and releasing keys
    const pressKey$ = from(keys).pipe(fromKeyDown((k) => new PressKey(k)));
    const holdKey$ = from(keys).pipe(fromKeyDown((k) => new HoldKey(k)));
    const releaseKey$ = from(keys).pipe(
        fromKey("keyup")((k) => new ReleaseKey(k)),
    );

    // Creates stream for restarting the game
    const restart$ = key$("keydown", "KeyR");

    /** Determines the rate of time steps */
    const tick$ = interval(Constants.TICK_RATE_MS);
    const gameClock$ = tick$.pipe(map((elapsed) => new Tick(elapsed)));

    /** Game music */

    // Parses the notes from the contents of the song CSV file
    const arrayOfNoteData = parseCsvToNoteData(csvContents);

    // Finds the minimum and maximum pitches of the user played parts of music
    const pitches = arrayOfNoteData
        .filter((noteData) => noteData.userPlayed)
        .map((note) => note.pitch);

    const minPitch = Math.min(...pitches);
    const maxPitch = Math.max(...pitches);

    // Creates stream for background circles
    const bgCircle$ = from(arrayOfNoteData).pipe(
        filter((noteData) => !noteData.userPlayed),
        mergeMap((noteData) =>
            of(noteData).pipe(
                delay(noteData.start * 1000),
                map((noteData) => new CreateBgCircle(noteData)),
            ),
        ),
    );

    // Creates stream for playable circles
    const circle$ = from(arrayOfNoteData).pipe(
        filter((noteData) => noteData.userPlayed),
        mergeMap((noteData) =>
            of(noteData).pipe(
                delay(noteData.start * 1000),
                map(
                    (noteData) =>
                        new CreateCircle(noteData, minPitch, maxPitch),
                ),
            ),
        ),
    );

    /** Ending the game */

    // Calculates the time taken for the last note to reach the bottom row
    const lastNoteEnd = Math.max(...arrayOfNoteData.map((note) => note.end));
    const topToBottomTime =
        ((Constants.TARGET_CY - Note.START_CY) / Note.MOVEMENT) *
        Constants.TICK_RATE_MS;
    const gameEndTime = lastNoteEnd * 1000 + topToBottomTime;

    // Ends the game after above time
    const endGame$ = timer(gameEndTime).pipe(map(() => new EndGame()));

    const action$: Observable<Action> = merge(
        gameClock$,
        pressKey$,
        holdKey$,
        releaseKey$,
        bgCircle$,
        circle$,
        endGame$,
    );

    // If restart key is pressed, the previous interval observable is
    // canceled, and a new game begins
    const state$: Observable<State> = restart$.pipe(
        // Start with an initial value to trigger the first game state
        startWith(null),
        switchMap(() =>
            action$.pipe(
                scan(reduceState, initialState),
                startWith(initialState),
            ),
        ),
    );

    const subscription: Subscription = state$.subscribe((state) => {
        // Upon restart, remove circles and tails from the game canvas.
        // The notes of all tails are also stopped, to take care of the event
        // where the player restarts while holding a tail.
        state === initialState &&
            (resetCanvas(), stopAllTailNotes(arrayOfNoteData));
        updateView(() => {})(state);
    });
}

/**
 * Display key mapping with live highlighting of the currently depressed key.
 * Code adopted from Week 4 Workshop.
 */
function showKeys() {
    function showKey(k: ColumnKey | Key) {
        const arrowKey = document.getElementById(k);
        // getElement might be null, in this case return without doing anything
        if (!arrowKey) return;
        const o = (e: Event) =>
            fromEvent<KeyboardEvent>(document, e).pipe(
                filter(({ code }) => code === k),
            );
        o("keydown").subscribe((e) => arrowKey.classList.add("highlight"));
        o("keyup").subscribe((_) => arrowKey.classList.remove("highlight"));
    }
    showKey("KeyH");
    showKey("KeyJ");
    showKey("KeyK");
    showKey("KeyL");
    showKey("KeyR");
}

// The following simply runs your main function on window load.  Make sure to leave it in place.
// You should not need to change this, beware if you are.
if (typeof window !== "undefined") {
    const startGame = (contents: string) => {
        document.body.addEventListener(
            "mousedown",
            function () {
                main(contents);
                showKeys();
            },
            { once: true },
        );
    };

    const { protocol, hostname, port } = new URL(import.meta.url);
    const baseUrl = `${protocol}//${hostname}${port ? `:${port}` : ""}`;

    Tone.ToneAudioBuffer.loaded().then(() => {
        for (const instrument in samples) {
            samples[instrument].toDestination();
            samples[instrument].release = 0.5;
        }

        fetch(`${baseUrl}/assets/${Constants.SONG_NAME}.csv`)
            .then((response) => response.text())
            .then((text) => startGame(text))
            .catch((error) =>
                console.error("Error fetching the CSV file:", error),
            );
    });
}
