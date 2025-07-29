export { Viewport, Constants, Note, keyToColumn };
export type {
    ColumnKey,
    Key,
    Event,
    State,
    Action,
    Circle,
    NoteData,
    BgCircle,
    Tail,
};

/** Constants */

/**
 * Viewport dimensions for the game canvas
 */
const Viewport = {
    CANVAS_WIDTH: 200,
    CANVAS_HEIGHT: 400,
} as const;

/**
 * Various constants used throughout the game
 */
const Constants = {
    TICK_RATE_MS: 5,
    SONG_NAME: "RockinRobin",
    VELOCITY_NORMALISATION_FACTOR: 1000,
    STARTING_OBJ_COUNT: 0,
    TARGET_CY: 350,
    TARGET_RANGE: 20,
    EXPIRE_LIMIT: 400,
    STARTING_SCORE: 0,
    SCORE_INCREASE: 10,
    BASE_CONSECUTIVE_HITS: 0,
    BASE_MULTIPLIER: 1,
    MULTIPLIER_INCREASE: 0.2,
    HITS_PER_MULTIPLIER_INCREASE: 10,
    STARTING_RANDOM_NUMBER: 0.1,
} as const;

/**
 *  Constants related to circles/notes
 */
const Note = {
    START_CY: 0,
    RADIUS: 0.07 * Viewport.CANVAS_WIDTH,
    TAIL_WIDTH: 10,
    MOVEMENT: 1,
    DURATION_FOR_TAIL: 1,
} as const;

/** User input */

/**
 * A string literal type for each key used for a column in game control.
 */
type ColumnKey = "KeyH" | "KeyJ" | "KeyK" | "KeyL";

/**
 * A string literal type for each key not used for a column in game control.
 */
type Key = "Space" | "KeyR";

/**
 * Mapping of keys to their respective column positions.
 */
const keyToColumn = {
    KeyH: "20%",
    KeyJ: "40%",
    KeyK: "60%",
    KeyL: "80%",
} as const;

/**
 * Event types for user input.
 */
type Event = "keydown" | "keyup" | "keypress";

/** State processing */

/**
 * Game state
 */
type State = Readonly<{
    backgroundCircles: ReadonlyArray<BgCircle>;
    circles: ReadonlyArray<Circle>;
    playedCircles: ReadonlyArray<Circle>;
    tails: ReadonlyArray<Tail>;
    finishedTails: ReadonlyArray<Tail>;
    exit: ReadonlyArray<Circle | Tail>;
    objCount: number;
    score: number;
    consecutiveHits: number;
    multiplier: number;
    randomNumber: number;
    gameEnd: boolean;
}>;

/**
 * The data of the note played by a circle.
 */
type NoteData = Readonly<{
    userPlayed: boolean;
    instrumentName: string;
    velocity: number;
    pitch: number;
    start: number;
    end: number;
}>;

/**
 * Helps to identify objects when updating view
 */
type ObjectId = Readonly<{ id: string }>;

/**
 * A playable circle that the player can press to play its note in game.
 */
type Circle = Readonly<
    ObjectId & {
        r: string;
        cx: string;
        cy: string;
        style: string;
        class: string;
        note: NoteData;
        hasTail: boolean;
    }
>;

/**
 * A circle that plays its note when it reaches the bottom, player does not
 * interact with it.
 */
type BgCircle = Readonly<{
    cy: string;
    note: NoteData;
}>;

/**
 * The tail of a circle with a note longer than a second.
 */
type Tail = Readonly<
    ObjectId & {
        x1: string;
        y1: string;
        x2: string;
        y2: string;
        style: string;
        isPlayed: boolean;
        isStartNote: boolean;
        circle: Circle;
        class: string;
    }
>;

/**
 * Actions modify state
 */
interface Action {
    apply(s: State): State;
}
