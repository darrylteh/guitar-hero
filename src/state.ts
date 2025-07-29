export {
    initialState,
    Tick,
    PressKey,
    reduceState,
    CreateCircle,
    CreateBgCircle,
    ReleaseKey,
    HoldKey,
    EndGame,
};
import {
    ColumnKey,
    State,
    Action,
    Circle,
    BgCircle,
    NoteData,
    Note,
    Constants,
    Tail,
    keyToColumn,
} from "./types";
import { not, except, generateRandomNote, RNG } from "./util";

/////////////// INITIAL STATE SET UP ////////////////////

const initialState: State = {
    backgroundCircles: [],
    circles: [],
    playedCircles: [],
    tails: [],
    finishedTails: [],
    exit: [],
    objCount: Constants.STARTING_OBJ_COUNT,
    score: Constants.STARTING_SCORE,
    consecutiveHits: Constants.BASE_CONSECUTIVE_HITS,
    multiplier: Constants.BASE_MULTIPLIER,
    randomNumber: Constants.STARTING_RANDOM_NUMBER,
    gameEnd: false,
};

/////////////// HELPER FUNCTIONS ////////////////////

/**
 * Calculates and returns the column and colour to which a circle belongs to.
 * @param noteData Note data of the circle
 * @param minPitch The minimum pitch among the playable notes
 * @param maxPitch The maximum pitch among the playable notes
 * @returns column and colour of circle
 */
const getColumnAndColour = (
    noteData: NoteData,
    minPitch: number,
    maxPitch: number,
): { column: string; colour: string } => {
    const columnArray = ["20%", "40%", "60%", "80%"];
    const colourArray = ["green", "red", "blue", "yellow"];
    // Splits circles into 4 columns based on note pitch
    const intervalSize = (maxPitch - minPitch) / 4;
    const index = Math.min(
        Math.floor((noteData.pitch - minPitch) / intervalSize),
        3,
    );

    return { column: columnArray[index], colour: colourArray[index] } as const;
};

/**
 * Checks if a circle is aligned with the player's press/hold of key.
 * @param circle The circle to check
 * @param cx The x-coordinate of the column
 * @returns true if the circle is aligned, false otherwise
 */
const isCircleAligned = (circle: Circle, cx: string): boolean => {
    return (
        circle.cx === cx &&
        Number(circle.cy) >= Constants.TARGET_CY - Constants.TARGET_RANGE &&
        Number(circle.cy) <= Constants.TARGET_CY + Constants.TARGET_RANGE
    );
};

/**
 * Checks if the end of a tail is aligned with the player's release of key.
 * @param tail The tail to check
 * @param cx The x-coordinate of the column
 * @returns true if the tail end is aligned, false otherwise
 */
const isTailEndAligned = (tail: Tail, cx: string): boolean => {
    return (
        tail.x1 === cx &&
        Number(tail.y2) >= Constants.TARGET_CY - Constants.TARGET_RANGE &&
        Number(tail.y2) <= Constants.TARGET_CY
    );
};

/**
 * Initialises PressKey and HoldKey by filtering circles based on alignment.
 * @param s The current state
 * @param key The key corresponding to the column
 * @returns An object containing aligned circles, tail circles, and
 * remaining circles at key's column
 */
const initialisePressAndHoldKey = (
    s: State,
    key: ColumnKey,
): {
    alignedCircles: ReadonlyArray<Circle>;
    alignedTailCircles: ReadonlyArray<Circle>;
    remainingCircles: ReadonlyArray<Circle>;
} => {
    const cx = keyToColumn[key];
    const alignedCircles = s.circles.filter((c) => isCircleAligned(c, cx));
    const alignedTailCircles = alignedCircles.filter((c) => c.hasTail);
    const remainingCircles = s.circles.filter((c) => !isCircleAligned(c, cx));
    return {
        alignedCircles,
        alignedTailCircles,
        remainingCircles,
    } as const;
};

/**
 * Calculates the new multiplier based on the number of consecutive hits.
 * @param newConsecutiveHits The number of new consecutive hits
 * @returns The new multiplier
 */
const calculateNewMultiplier = (newConsecutiveHits: number): number =>
    // Base multiplier of 1 is increased by 0.2 for every 10 consecutive hits
    Number(
        (
            Constants.BASE_MULTIPLIER +
            Math.floor(
                newConsecutiveHits / Constants.HITS_PER_MULTIPLIER_INCREASE,
            ) *
                Constants.MULTIPLIER_INCREASE
        ).toFixed(1),
    );

/**
 * Updates consecutive hits and multiplier based on whether a miss occurred.
 * @param isMiss - Boolean indicating if a miss occurred.
 * @param consecutiveHits - The current number of consecutive hits.
 * @param additionalHits - Additional hits to add if not a miss.
 * @returns An object containing the new consecutive hits and multiplier.
 */
const updateHitsAndMultiplier = (
    isMiss: boolean,
    consecutiveHits: number,
    additionalHits: number,
): { newConsecutiveHits: number; newMultiplier: number } => {
    const newConsecutiveHits = isMiss
        ? Constants.BASE_CONSECUTIVE_HITS
        : consecutiveHits + additionalHits;
    const newMultiplier = isMiss
        ? Constants.BASE_MULTIPLIER
        : calculateNewMultiplier(newConsecutiveHits);

    return { newConsecutiveHits, newMultiplier } as const;
};

/**
 * If a miss occurs, rehashes random number and uses it as the seed to generate
 * a new random background circle to be played.
 * @param isMiss - Boolean indicating if a miss occurred.
 * @param randomNumber - The current random number.
 * @param backgroundCircles - The current array of background circles.
 * @returns An object containing the new random number and the updated array of
 * background circles.
 */
const addRandomBgCircle = (
    isMiss: boolean,
    randomNumber: number,
    backgroundCircles: ReadonlyArray<BgCircle>,
): { newRandomNumber: number; newBgCircles: ReadonlyArray<BgCircle> } => {
    const newRandomNumber = isMiss ? RNG.hash(randomNumber) : randomNumber;

    const newBgCircles = isMiss
        ? backgroundCircles.concat(generateRandomNote(newRandomNumber))
        : backgroundCircles;

    return { newRandomNumber, newBgCircles } as const;
};

//////////////// STATE UPDATES //////////////////////

// Action types that trigger game state transitions

class Tick implements Action {
    /**
     * Constructs a new instance of Tick.
     * @param elapsed The time elapsed since the last tick in milliseconds
     */
    constructor(public readonly elapsed: number) {}
    /**
     * An interval tick: circles and tails move, checks for missed circles,
     * fully played tails, expired circles and tails and updates the score,
     * consecutive hits and multiplier accordingly.
     * @param s The current State
     * @returns New State
     */
    apply(s: State): State {
        // Functions to determine the state of circles and tails
        const isCircleExpired = (c: Circle) =>
            Number(c.cy) > Constants.EXPIRE_LIMIT;
        const isMissed = (c: Circle) =>
            Number(c.cy) > Constants.TARGET_CY + Constants.TARGET_RANGE;
        const isTailExpired = (t: Tail) =>
            Number(t.y2) > Constants.EXPIRE_LIMIT;
        const isTailFullyPlayed = (t: Tail) => Number(t.y2) === Number(t.y1);

        // Filter circles and tails based on their state
        const expiredCircles = s.circles.filter(isCircleExpired);
        const activeCircles = s.circles.filter(not(isCircleExpired));
        const missedCircles = s.circles.filter(isMissed);

        const expiredTails = s.tails.filter(isTailExpired);
        const fullyPlayedTails = s.tails.filter(isTailFullyPlayed);

        // Stops sound of remaining active tails
        const activeTails = s.tails
            .filter(not(isTailExpired))
            .filter(not(isTailFullyPlayed))
            // This ensures that tails being played call startNote only once
            .map((t) => ({
                ...t,
                isStartNote: false,
            }));

        // If any circles missed, consecutive hits and multiplier are reset
        // to 0 and 1 respectively
        // If no circles missed, increase consecutive hits for each tail fully
        // played and update multiplier
        const isMissedCircles = missedCircles.length > 0;
        const { newConsecutiveHits, newMultiplier } = updateHitsAndMultiplier(
            isMissedCircles,
            s.consecutiveHits,
            fullyPlayedTails.length,
        );

        // Calculates new score based on fully played tails and new multiplier
        const newScore =
            s.score +
            fullyPlayedTails.length * Constants.SCORE_INCREASE * newMultiplier;

        // Moves all circles and tails, removing background circles played
        const newBgCircles = s.backgroundCircles
            .map((c) => Tick.moveCircle(c))
            .filter((c) => Number(c.cy) <= Constants.TARGET_CY);
        const newCircles = activeCircles.map((c) => Tick.moveCircle(c));
        const newTails = activeTails.map((t) => Tick.moveTail(t));

        return {
            ...s,
            backgroundCircles: newBgCircles,
            circles: newCircles,
            playedCircles: [],
            tails: newTails,
            finishedTails: fullyPlayedTails,
            score: newScore,
            exit: [...expiredCircles, ...expiredTails],
            consecutiveHits: newConsecutiveHits,
            multiplier: newMultiplier,
        };
    }

    /**
     * Moves a circle down by a fixed amount.
     * @param c Circle to move.
     * @returns Moved circle.
     */
    static moveCircle<T extends { cy: string }>(c: T): T {
        return {
            ...c,
            cy: `${Number(c.cy) + Note.MOVEMENT}`,
        };
    }

    /**
     * Moves a tail down by a fixed amount.
     * - If the tail is played, it moves y1 and y2 separately.
     * - If the tail is unplayed, it moves y1 and y2 together.
     * @param t Tail to move.
     * @returns Moved tail.
     */
    static moveTail = (t: Tail): Tail => {
        // Helper function to increment the y-coordinate
        const incrementY = (y: string): string =>
            `${Number(y) + Note.MOVEMENT}`;

        // Moves y1 down until it reaches target, moves y2 down until it reaches
        // y1. Visualises the tail being played, with the tail becoming smaller
        const movePlayedTail = (t: Tail): Tail => ({
            ...t,
            y1: Number(t.y1) >= Constants.TARGET_CY ? t.y1 : incrementY(t.y1),
            y2: Number(t.y2) === Number(t.y1) ? t.y2 : incrementY(t.y2),
        });

        // y1 and y2 move down together, maintaining the same distance apart,
        // therefore the tail remains the same length as it moves down
        const moveUnplayedTail = (t: Tail): Tail => ({
            ...t,
            y1: incrementY(t.y1),
            y2: incrementY(t.y2),
        });

        return t.isPlayed ? movePlayedTail(t) : moveUnplayedTail(t);
    };
}

class CreateCircle implements Action {
    /**
     * Constructs a new instance of CreateCircle.
     * @param noteData The note data of the new circle
     * @param minPitch The minimum pitch among the playable notes
     * @param maxPitch The maximum pitch among the playable notes
     */
    constructor(
        public readonly noteData: NoteData,
        public readonly minPitch: number,
        public readonly maxPitch: number,
    ) {}
    /**
     * Adds a new playable circle object to the state.
     * @param s The current State
     * @returns New State with circle
     */
    apply(s: State): State {
        // Determine the column and color for the new circle based on its pitch
        const { column, colour } = getColumnAndColour(
            this.noteData,
            this.minPitch,
            this.maxPitch,
        );

        // Creates circle object, with unique id and determined column/colour
        const newCircle = {
            id: "circle" + s.objCount,
            r: `${Note.RADIUS}`,
            cx: `${column}`,
            cy: `${Note.START_CY}`,
            style: `fill: ${colour}`,
            class: "playable",
            note: this.noteData,
            hasTail:
                this.noteData.end - this.noteData.start >
                Note.DURATION_FOR_TAIL,
        };

        // Calculates the length of the tail of circle
        const tailLength = Math.round(
            ((this.noteData.end - this.noteData.start) * 1000 * Note.MOVEMENT) /
                Constants.TICK_RATE_MS,
        );

        // If circle has tail, creates and adds new tail
        const updatedTails = newCircle.hasTail
            ? s.tails.concat({
                  id: "tail" + s.objCount,
                  x1: `${column}`,
                  y1: `${Note.START_CY}`,
                  x2: `${column}`,
                  y2: `${Note.START_CY - tailLength}`,
                  style: `stroke:${colour};stroke-width:${Note.TAIL_WIDTH}`,
                  isPlayed: false,
                  isStartNote: false,
                  circle: newCircle,
                  class: "playable",
              })
            : s.tails;

        return {
            ...s,
            circles: [...s.circles, newCircle],
            tails: updatedTails,
            objCount: s.objCount + 1,
        };
    }
}

class CreateBgCircle implements Action {
    /**
     * Constructs a new instance of CreateBgCircle.
     * @param noteData The note data of the new background circle
     */
    constructor(public readonly noteData: NoteData) {}
    /**
     * Adds a new background circle object to the state.
     * @param s The current State
     * @returns New State with background circle
     */
    apply(s: State): State {
        return {
            ...s,
            backgroundCircles: s.backgroundCircles.concat({
                cy: `${Note.START_CY}`,
                note: this.noteData,
            }),
        };
    }
}

class PressKey implements Action {
    /**
     * Constructs a new instance of PressKey.
     * @param key The key pressed
     */
    constructor(public readonly key: ColumnKey) {}
    /**
     * The action of pressing a playable circle without a tail.
     * Finds circles that are aligned/not aligned and updates the game state
     * accordingly.
     * @param s The current State
     * @returns New State after pressing key
     */
    apply(s: State): State {
        const { alignedCircles, alignedTailCircles, remainingCircles } =
            initialisePressAndHoldKey(s, this.key);

        // If there are circles with tails aligned, use HoldKey instead
        if (alignedTailCircles.length > 0) {
            return s;
        }

        // If the player presses their key with no circles aligned, it's a miss
        const isMiss = alignedCircles.length === 0;

        // Update consecutive hits/multiplier based on whether press is a miss
        const { newConsecutiveHits, newMultiplier } = updateHitsAndMultiplier(
            isMiss,
            s.consecutiveHits,
            1,
        );

        // Each aligned circle leads to an increase in score
        const newScore =
            s.score +
            alignedCircles.length * Constants.SCORE_INCREASE * newMultiplier;

        // On a miss, rehash State's random number to generate random BgCircle
        const { newRandomNumber, newBgCircles } = addRandomBgCircle(
            isMiss,
            s.randomNumber,
            s.backgroundCircles,
        );

        return {
            ...s,
            circles: remainingCircles,
            playedCircles: alignedCircles,
            score: newScore,
            backgroundCircles: newBgCircles,
            consecutiveHits: newConsecutiveHits,
            multiplier: newMultiplier,
            randomNumber: newRandomNumber,
        };
    }
}

class HoldKey implements Action {
    /**
     * Constructs a new instance of HoldKey.
     * @param key The key held
     */
    constructor(public readonly key: ColumnKey) {}
    /**
     * The action of holding a playable circle with a tail.
     * Finds circles with tails that are aligned and their tails and updates the
     * game state accordingly.
     * @param s The current State
     * @returns new State after holding key
     */
    apply(s: State): State {
        const { alignedTailCircles, remainingCircles } =
            initialisePressAndHoldKey(s, this.key);

        // If there are no circles with tails aligned, use PressKey instead
        if (alignedTailCircles.length === 0) {
            return s;
        }

        // Find all tails of aligned circles with tails
        const alignedTails = s.tails.filter((t) =>
            alignedTailCircles.some((c) => c.id === t.circle.id),
        );

        // Sets tails' isPlayed to true and start playing note sound
        const playedTails = alignedTails.map((t) => ({
            ...t,
            isPlayed: true,
            isStartNote: true,
        }));

        // Gets all tails that are not played
        const remainingTails = except((a: Tail) => (b: Tail) => a.id === b.id)(
            s.tails,
        )(playedTails);

        return {
            ...s,
            circles: remainingCircles,
            playedCircles: [...s.playedCircles, ...alignedTailCircles],
            tails: [...playedTails, ...remainingTails],
        };
    }
}

class ReleaseKey implements Action {
    /**
     * Constructs a new instance of ReleaseKey.
     * @param key The key released
     */
    constructor(public readonly key: ColumnKey) {}
    /**
     * The action of releasing a key to let go of a tail.
     * Finds tails already played in the same column and updates the
     * game state accordingly.
     * @param s The current State
     * @returns New State after releasing key
     */
    apply(s: State): State {
        const cx = keyToColumn[this.key];

        // Gets all played tails in the same column
        const playedTails = s.tails
            .filter((t) => t.isPlayed)
            .filter((t) => t.x1 === cx);

        // If there are no tails, do nothing
        if (playedTails.length === 0 && s.finishedTails.length === 0) {
            return s;
        }

        // If player lets go of tail early within a certain range, the tail is
        // played to completion. Otherwise if too early, tail stops being played
        // and moves past target.
        const updatedPlayedTails = playedTails.map((t) => ({
            ...t,
            isPlayed: isTailEndAligned(t, cx) ? true : false,
        }));

        // Determines if the release is a miss and updates the consecutive
        // hits and multiplier accordingly.
        const alignedPlayedTails = updatedPlayedTails.filter((t) =>
            isTailEndAligned(t, cx),
        );
        const isMiss = alignedPlayedTails.length === 0;
        const { newConsecutiveHits, newMultiplier } = updateHitsAndMultiplier(
            isMiss,
            s.consecutiveHits,
            0,
        );

        const remainingTails = s.tails.filter(
            (t) => !playedTails.some((playedTail) => playedTail.id === t.id),
        );

        // On a miss, rehash State's random number to generate random BgCircle
        const { newRandomNumber, newBgCircles } = addRandomBgCircle(
            isMiss,
            s.randomNumber,
            s.backgroundCircles,
        );

        return {
            ...s,
            tails: [...updatedPlayedTails, ...remainingTails],
            backgroundCircles: newBgCircles,
            consecutiveHits: newConsecutiveHits,
            multiplier: newMultiplier,
            randomNumber: newRandomNumber,
        };
    }
}

class EndGame implements Action {
    /**
     * The action of ending the game.
     * Sets State's gameEnd to true, ending the game.
     * @param s The current State
     * @returns New State after ending game
     */
    apply(s: State): State {
        return {
            ...s,
            gameEnd: true,
        };
    }
}

/**
 * state transducer
 * @param s input State
 * @param action type of action to apply to the State
 * @returns a new State
 */
const reduceState = (s: State, action: Action) => {
    const reducedState = action.apply(s);

    // If game has ended, no more state changes
    if (s.gameEnd) {
        return s;
    }

    return reducedState;
};
