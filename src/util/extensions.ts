 /*$$$$$$$             /$$                                   /$$
| $$_____/            | $$                                  |__/
| $$       /$$   /$$ /$$$$$$    /$$$$$$  /$$$$$$$   /$$$$$$$ /$$  /$$$$$$  /$$$$$$$   /$$$$$$$
| $$$$$   |  $$ /$$/|_  $$_/   /$$__  $$| $$__  $$ /$$_____/| $$ /$$__  $$| $$__  $$ /$$_____/
| $$__/    \  $$$$/   | $$    | $$$$$$$$| $$  \ $$|  $$$$$$ | $$| $$  \ $$| $$  \ $$|  $$$$$$
| $$        >$$  $$   | $$ /$$| $$_____/| $$  | $$ \____  $$| $$| $$  | $$| $$  | $$ \____  $$
| $$$$$$$$ /$$/\  $$  |  $$$$/|  $$$$$$$| $$  | $$ /$$$$$$$/| $$|  $$$$$$/| $$  | $$ /$$$$$$$/
|________/|__/  \__/   \___/   \_______/|__/  |__/|_______/ |__/ \______/ |__/  |__/|______*/

declare global {
    interface Array<T> {
        add(item: T): number;
        addAt(index: number, item: T): void;
        remove(item: T): number;
        removeAt(index: number): T | undefined;
        isEmpty(): boolean;
    }
}

Array.prototype.add = function <T>(this: T[], item: T): number {
    return this.push(item) - 1;
};

Array.prototype.addAt = function <T>(this: T[], index: number, item: T): void {
    this.splice(index, 0, item);
};

Array.prototype.remove = function <T>(this: T[], item: T): number {
    const index = this.indexOf(item);
    if (index !== -1) {
        this.splice(index, 1);
    }
    return index;
};

Array.prototype.removeAt = function <T>(this: T[], index: number): T | undefined {
    return this.splice(index, 1)[0];
};

Array.prototype.isEmpty = function <T>(this: T[]): boolean {
    return this.length == 0;
};

export {};
