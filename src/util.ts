export {
    RNG,
    not,
    except,
    attr,
    playNote,
    startNote,
    stopNote,
    stopAllTailNotes,
    samples,
    isNotNullOrUndefined,
    generateRandomNote,
    parseCsvToNoteData,
};
import { NoteData, BgCircle, Constants } from "./types";
import * as Tone from "tone";
import { SampleLibrary } from "./tonejs-instruments";

/** Utility functions */

/**
 * A random number generator which provides two pure functions
 * `hash` and `scaleToRange`.  Call `hash` repeatedly to generate the
 * sequence of hashes.
 * Code adopted from Week 4 Workshop.
 */
abstract class RNG {
    // LCG using GCC's constants
    private static m = 0x80000000; // 2**31
    private static a = 1103515245;
    private static c = 12345;

    /**
     * Call `hash` repeatedly to generate the sequence of hashes.
     * Code adopted from Week 4 Workshop.
     * @param seed
     * @returns a hash of the seed
     */
    public static hash = (seed: number) => (RNG.a * seed + RNG.c) % RNG.m;

    /**
     * Takes hash value and scales it to the range [-1, 1]
     * Code adopted from Week 4 Workshop.
     */
    public static scale = (hash: number) => (2 * hash) / (RNG.m - 1) - 1;

    /**
     * Takes hash value and scales it to the range [min, max]
     */
    public static scaleToRange = (hash: number, min: number, max: number) => {
        return min + (hash / (RNG.m - 1)) * (max - min);
    };
}

/**
 * Generates a random note based on a given seed and returns a background
 * circle with the note.
 */
const generateRandomNote = (seed: number): BgCircle => {
    const instruments = [
        "bass-electric",
        "violin",
        "piano",
        "trumpet",
        "saxophone",
        "trombone",
        "flute",
    ];

    // Randomly generates properties of note data, and creates NoteData object
    const instrumentIndex = Math.floor(
        RNG.scaleToRange(seed, 0, instruments.length),
    );
    const instrumentName = instruments[instrumentIndex];
    const velocity = Math.floor(RNG.scaleToRange(seed, 30, 127));
    const pitch = Math.floor(RNG.scaleToRange(seed, 30, 90));
    const length = RNG.scaleToRange(seed, 0, 0.5);

    const randomNoteData: NoteData = {
        userPlayed: false,
        instrumentName: instrumentName,
        velocity: velocity,
        pitch: pitch,
        start: 0.0,
        end: length,
    };
    // Returns BgCircle object with created NoteData object
    return {
        cy: `${Constants.TARGET_CY}`, // cy set so note is immediately played
        note: randomNoteData,
    };
};

const /**
     * Composable not: invert boolean result of given function
     * Code adopted from Week 4 Workshop.
     * @param f a function returning boolean
     * @param x the value that will be tested with f
     */
    not =
        <T>(f: (x: T) => boolean) =>
        (x: T) =>
            !f(x),
    /**
     * is e an element of a using the eq function to test equality?
     * Code adopted from Week 4 Workshop.
     * @param eq equality test function for two Ts
     * @param a an array that will be searched
     * @param e an element to search a for
     */
    elem =
        <T>(eq: (_: T) => (_: T) => boolean) =>
        (a: ReadonlyArray<T>) =>
        (e: T) =>
            a.findIndex(eq(e)) >= 0,
    /**
     * array a except anything in b
     * Code adopted from Week 4 Workshop.
     * @param eq equality test function for two Ts
     * @param a array to be filtered
     * @param b array of elements to be filtered out of a
     */
    except =
        <T>(eq: (_: T) => (_: T) => boolean) =>
        (a: ReadonlyArray<T>) =>
        (b: ReadonlyArray<T>) =>
            a.filter(not(elem(eq)(b))),
    /**
     * set a number of attributes on an Element at once
     * Code adopted from Week 4 Workshop.
     * @param e the Element
     * @param o a property bag
     */
    attr = (e: Element, o: { [p: string]: unknown }) => {
        for (const k in o) e.setAttribute(k, String(o[k]));
    };

/**
 * Type guard for use in filters
 * Code adopted from Week 4 Workshop.
 * @param input something that might be null or undefined
 */
function isNotNullOrUndefined<T extends object>(
    input: null | undefined | T,
): input is T {
    return input != null;
}

// Loading in the instruments
const samples = SampleLibrary.load({
    instruments: [
        "bass-electric",
        "violin",
        "piano",
        "trumpet",
        "saxophone",
        "trombone",
        "flute",
    ], // SampleLibrary.list,
    baseUrl: "samples/",
});

/**
 * Given the note data, plays a note for a duration.
 */
const playNote = (noteData: NoteData) => {
    const { instrumentName, velocity, pitch, start, end } = noteData;
    samples[instrumentName].triggerAttackRelease(
        Tone.Frequency(pitch, "midi").toNote(),
        end - start,
        undefined,
        velocity / Constants.VELOCITY_NORMALISATION_FACTOR,
    );
};

/**
 * Given the note data, starts playing a note.
 */
const startNote = (noteData: NoteData) => {
    const { instrumentName, velocity, pitch } = noteData;
    samples[instrumentName].triggerAttack(
        Tone.Frequency(pitch, "midi").toNote(),
        undefined,
        velocity / Constants.VELOCITY_NORMALISATION_FACTOR,
    );
};

/**
 * Given the note data, stops playing a note.
 */
const stopNote = (noteData: NoteData) => {
    const { instrumentName, pitch } = noteData;
    samples[instrumentName].triggerRelease(
        Tone.Frequency(pitch, "midi").toNote(),
    );
};

/**
 * Stops all tail notes that were played by the user.
 * @param noteDataArray An array of NoteData objects
 */
const stopAllTailNotes = (noteDataArray: NoteData[]) => {
    noteDataArray
        .filter((note) => note.userPlayed)
        .filter((note) => note.end - note.start > 0)
        .forEach(stopNote);
};

/**
 * Given the string CSV contents, parses it into an array of NoteData objects.
 * @param csvContents The CSV content as a string
 * @returns An array of NoteData objects
 */
const parseCsvToNoteData = (csvContents: string): NoteData[] => {
    return (
        csvContents
            .trim() // Remove leading and trailing empty lines
            .split("\n")
            .slice(1) // Excludes the header
            // Creates NoteData for each valid line in CSV
            .map((eachString) => {
                const noteAttributes = eachString.split(",");
                return {
                    userPlayed: noteAttributes[0] === "True",
                    instrumentName: noteAttributes[1],
                    velocity: Number(noteAttributes[2]),
                    pitch: Number(noteAttributes[3]),
                    start: Number(noteAttributes[4]),
                    end: Number(noteAttributes[5]),
                };
            })
    );
};
