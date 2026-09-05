export class ListAdapter<ItemT, HolderT> {

    private root: HTMLElement
    private list: ItemT[] = [];
    private elements: HTMLElement[] = [];
    private holder: HolderT[] = [];

    private onInflate: (item: ItemT) => HTMLElement
    private onUpdate: (item: ItemT, index: number, element: HTMLElement) => HolderT

    constructor(root: HTMLElement, list: ItemT[], onInflate: (item: ItemT) => HTMLElement, onUpdate: (item: ItemT, index: number, element: HTMLElement) => HolderT) {
        //Save info
        this.root = root;
        this.list = list;
        this.onInflate = onInflate;
        this.onUpdate = onUpdate;

        //Generate items
        this.notifyDatasetChanged();
    }

    notifyDatasetChanged() {
        //Clear all elements
        this.root.innerHTML = '';
        this.elements.length = 0;
        this.holder.length = 0;

        //Create new items
        for (const [index, item] of this.list.entries()) {
            //Create element
            const element = this.onInflate(item);
            this.elements.push(element);

            //Init element
            const info = this.onUpdate(item, index, element);
            this.holder.push(info);

            //Add element to DOM
            this.root.appendChild(element);
        }
    }

    notifyItemRemoved(index: number) {
        //Check bounds
        if (index < 0 || index >= this.elements.length) return;

        //Remove element from DOM
        const element = this.elements[index];
        element.remove();

        //Remove info
        this.elements.splice(index, 1);
        this.holder.splice(index, 1);
    }

    notifyItemChanged(index: number) {
        //Check bounds
        if (index < 0 || index >= this.elements.length) return;

        //Get item and element
        const item = this.list[index];
        const element = this.elements[index];

        //Update element & holder
        this.holder[index] = this.onUpdate(item, index, element);
    }

    notifyItemAdded(index: number) {
        //Check bounds
        if (index < 0 || index > this.list.length) return;

        //Get item
        const item = this.list[index];

        //Create element
        const element = this.onInflate(item);
        this.elements.splice(index, 0, element);

        //Init element
        const info = this.onUpdate(item, index, element);
        this.holder.splice(index, 0, info);

        //Add element to DOM
        const nextElement = this.elements[index + 1] || null;
        this.root.insertBefore(element, nextElement);
    }

}