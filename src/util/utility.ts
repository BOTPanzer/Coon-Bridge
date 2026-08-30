 /*$   /$$   /$$     /$$ /$$
| $$  | $$  | $$    |__/| $$
| $$  | $$ /$$$$$$   /$$| $$
| $$  | $$|_  $$_/  | $$| $$
| $$  | $$  | $$    | $$| $$
| $$  | $$  | $$ /$$| $$| $$
|  $$$$$$/  |  $$$$/| $$| $$
 \______/    \___/  |__/|_*/

export class Util {

    //Math
    static clamp(x: number, min: number, max: number) {
        //Clamp x between min and max
        return Math.min(Math.max(x, min), max);
    }

    static randomInt(min: number, max: number) {
        //Get a random int between min and max
        return Math.floor(Math.random() * (max - min)) + min;
    }

    static round(value: number, decimals: number): number {
        const factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
    }

    //Lists
    static shuffleList<T>(list: T[]) {
        for (let i = list.length - 1; i > 0; i--) {
            const randomIndex = Math.floor(Math.random() * (i + 1));
            [list[i], list[randomIndex]] = [list[randomIndex], list[i]];
        }
    }

    static randomFromList<T>(list: T[], remove: boolean = false) {
        const index = Math.floor(Math.random() * list.length);
        const value = list[index];
        if (remove) list.splice(index, 1);
        return value;
    }

    //Events
    static interceptEvent(e: Event) {
        e.preventDefault();
        e.stopPropagation();
    }

    static onDialogBackdropClick(dialog: HTMLDialogElement, onClick: Function) {
        //Add on click event
        dialog.onclick = (event) => {
            const rect = dialog.getBoundingClientRect();
            const clickedBackdrop = !(rect.top <= event.clientY && event.clientY <= rect.top + rect.height && rect.left <= event.clientX && event.clientX <= rect.left + rect.width);
            if (clickedBackdrop && dialog.open) onClick();
        }
    }

    //Text
    static setCharAt(string: string, index: number, char: string) {
        if (index > string.length - 1) return string;
        return string.substring(0, index) + char + string.substring(index + 1);
    }

    static tokenize(text: string): string[] {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(Boolean)
            .map(word => (word.endsWith('s') && word.length > 3 ? word.slice(0, -1) : word));
    }

    static scoreBM25(queryTokens: string[], caption: string, avgDocLen: number, k1 = 1.2, b = 0.75): number {
        const docTokens = Util.tokenize(caption);
        if (queryTokens.length === 0 || docTokens.length === 0) return 0;

        const docLen = docTokens.length;
        let score = 0;

        for (const token of queryTokens) {
            // Count term frequency in the document
            const tf = docTokens.filter(t => t === token).length;
            if (tf > 0) {
                // BM25 Term Frequency weighting component 💫
                const numerator = tf * (k1 + 1);
                const denominator = tf + k1 * (1 - b + b * (docLen / avgDocLen));
                score += numerator / denominator;
            }
        }

        return score;
    }

}
