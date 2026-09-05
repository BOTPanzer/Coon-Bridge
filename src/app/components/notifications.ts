import { Util } from "../../util";

export type NotificationOptions = {
    duration?: number;
    action?: () => void;
}

export type Notification = {
    title: string;
    content: string;
    options: NotificationOptions;
}

export class NotificationManager {

    //State
    private areNotificationsActive = false
    private notificationsQueue: Notification[] = []

    //Actions
    create(title: string, content: string, options: object = {}) {
        //Push notification
        this.notificationsQueue.push({title, content, options});

        //Notify manager
        this.notify();
    }

    private notify = () => {
        //Check if a notification is active
        if (this.areNotificationsActive) return;

        //Check queue
        if (this.notificationsQueue.length > 0) {
            //There are notifications left -> Show next
            this.areNotificationsActive = true
            this.showNext()
        }
    }

    private showNext = () => {
        //Get notification & remove it from the queue
        const notification = this.notificationsQueue[0];
        this.notificationsQueue.shift()

        //Create notification element
        const element = document.createElement('div');
        element.classList.add('notification')

        const close = document.createElement('div');
        close.id = 'notification-close';
        close.innerText = '✕';
        element.appendChild(close);

        const title = document.createElement('div');
        title.id = 'notification-title';
        title.innerText = notification.title;
        element.appendChild(title);

        const content = document.createElement('div');
        content.id = 'notification-content';
        content.innerText = notification.content;
        element.appendChild(content);

        document.body.appendChild(element);

        //Get notification options
        const options = notification.options;
        
        //Check duration
        const duration = options.duration ?? 3000;
        const timeout = setTimeout(() => {
            this.closeNotification(timeout, element);
        }, duration)

        //Add listeners
        element.onclick = (event) =>  {
            //Intercept event
            Util.interceptEvent(event);

            //Run action
            options.action?.();

            //Close notification
            this.closeNotification(timeout, element);
        }
        close.onclick = (event) => {
            //Intercept event
            Util.interceptEvent(event);

            //Close notification
            this.closeNotification(timeout, element);
        }
    }

    private closeNotification = (timeout: any, element: HTMLElement) => {
        //Clear timeout
        clearTimeout(timeout);

        //Add an event that prevents the others
        element.onclick = (event) => { 
            //Intercept event
            Util.interceptEvent(event);
        }

        //Hide notification
        element.setAttribute('hidden', '');
        setTimeout(() => {
            element.remove();
            this.areNotificationsActive = false;
            this.notify();
        }, 700);
    }

}