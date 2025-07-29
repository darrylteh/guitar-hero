export { gameover, updateView, svg, resetCanvas };
import { State, Viewport, Circle, Tail, Constants } from "./types";
import {
    attr,
    isNotNullOrUndefined,
    playNote,
    startNote,
    stopNote,
} from "./util";

/** Rendering (side effects) */

/**
 * Removes all circles and tails from the game canvas.
 * Code adopted from Week 4 Applied and modified.
 */
const resetCanvas = () => {
    svg.querySelectorAll(".playable").forEach((x) => x.remove());
};

// document.getElementById can return null
// so use optional chaining to safely access method on element
// Code adopted from Week 4 Workshop.
const show = (id: string, condition: boolean) =>
    ((e: HTMLElement | null) =>
        condition ? e?.classList.remove("hidden") : e?.classList.add("hidden"))(
        document.getElementById(id),
    );

/**
 * Creates an SVG element with the given properties.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element for valid
 * element names and properties.
 *
 * @param namespace Namespace of the SVG element
 * @param name SVGElement name
 * @param props Properties to set on the SVG element
 * @returns SVG element
 */
const createSvgElement = (
    namespace: string | null,
    name: string,
    props: Record<string, string> = {},
) => {
    const elem = document.createElementNS(namespace, name) as SVGElement;
    Object.entries(props).forEach(([k, v]) => elem.setAttribute(k, v));
    return elem;
};

// Canvas elements
const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement &
    HTMLElement;
const preview = document.querySelector("#svgPreview") as SVGGraphicsElement &
    HTMLElement;
const gameover = document.querySelector("#gameOver") as SVGGraphicsElement &
    HTMLElement;
const container = document.querySelector("#main") as HTMLElement;

// Text fields
const multiplier = document.querySelector("#multiplierText") as HTMLElement;
const scoreText = document.querySelector("#scoreText") as HTMLElement;
const comboText = document.querySelector("#comboText") as HTMLElement;

/**
 * Update the SVG game view.
 *
 * @param onFinish a callback function to be applied when the game ends.
 * For example, to clean up subscriptions.
 * @param s the current game model State
 * @returns void
 */
function updateView(onFinish: () => void) {
    return function (s: State): void {
        svg.setAttribute("height", `${Viewport.CANVAS_HEIGHT}`);
        svg.setAttribute("width", `${Viewport.CANVAS_WIDTH}`);

        show("gameOver", s.gameEnd);

        // Updates the view of a circle
        const updateCircleView = (rootSVG: HTMLElement) => (c: Circle) => {
            function createCircleView() {
                const newCircle = createSvgElement(
                    rootSVG.namespaceURI,
                    "circle",
                    {
                        id: c.id,
                        r: c.r,
                        cx: c.cx,
                        cy: c.cy,
                        style: c.style,
                        class: c.class,
                    },
                );
                rootSVG.appendChild(newCircle);
                return newCircle;
            }
            // Updates circle's view, if view hasn't been created, creates it
            const updatingCircle =
                document.getElementById(c.id) || createCircleView();
            // Sets circle's view to its updated cy value, making it move down
            attr(updatingCircle, { cy: c.cy });
        };

        // Updates the view of a tail
        const updateTailView = (rootSVG: HTMLElement) => (t: Tail) => {
            function createTailView() {
                const newTail = createSvgElement(rootSVG.namespaceURI, "line", {
                    id: t.id,
                    x1: t.x1,
                    y1: t.y1,
                    x2: t.x2,
                    y2: t.y2,
                    style: t.style,
                    class: t.class,
                });
                rootSVG.appendChild(newTail);
                return newTail;
            }
            // Updates tail's view, if view hasn't been created, creates it
            const updatingTail =
                document.getElementById(t.id) || createTailView();
            // Sets tail's view to its updated y1/y2 values, making it move
            attr(updatingTail, { y1: t.y1, y2: t.y2 });
        };

        // Update view of existing circles
        s.circles.forEach(updateCircleView(svg));

        // Play notes of background circle that have moved down to target cy
        s.backgroundCircles
            .filter((c) => Number(c.cy) === Constants.TARGET_CY)
            .forEach((c) => {
                playNote(c.note);
            });

        // Play notes of played circles and remove them
        s.playedCircles
            .filter((c) => !c.hasTail)
            .forEach((c) => playNote(c.note));

        // Update view of existing tails
        s.tails.forEach(updateTailView(svg));

        // Play sound of played tails
        s.tails
            .filter((t) => t.isPlayed && t.isStartNote)
            .forEach((t) => startNote(t.circle.note));

        // Stop sound of finished tails and tails that stopped being held
        const stoppedTails = s.tails.filter(
            (t) => t.isPlayed === false && !t.isStartNote,
        );
        s.finishedTails
            .concat(stoppedTails)
            .forEach((t) => stopNote(t.circle.note));

        // Remove exited circles and tails
        [...s.exit, ...s.playedCircles, ...s.finishedTails]
            .map((c) => document.getElementById(c.id))
            .filter(isNotNullOrUndefined)
            .forEach((v) => {
                try {
                    svg.removeChild(v);
                } catch (e) {
                    console.log("Already removed: " + v.id);
                }
            });

        scoreText.innerHTML = String(s.score);
        multiplier.innerHTML = `${s.multiplier}x`;
        comboText.innerHTML = String(s.consecutiveHits);
    };
}
