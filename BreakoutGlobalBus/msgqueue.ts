import { Subject, ReplaySubject, Observable, merge } from "rxjs";
import { Message } from "./interface";
import { filter, tap, map } from "rxjs/operators";

export class MessageQueue {
    private queue: Subject<Message<any>>;
    private providers: Observable<any>[];
    private started: boolean;
    constructor() {
        this.queue = new ReplaySubject();
        this.providers = [];
        this.started = false;
    }
    put<T>(name: string, msg: T): void {
        this.queue.next({
            name: name,
            msg: msg
        });
    }
    subqueue(name: string): Observable<any> {
        return this.queue.asObservable().pipe(
            filter(e => e.name == name),
            map((e: Message<any>) => e.msg)
        );
    }
    addProvider(name: string, provider: Observable<any>) {
        this.providers.push(provider.pipe(
            tap(e => this.put(name, e))
        ));
    }
    start() {
        if (!this.started) {
            this.started = true;
            merge(...this.providers).subscribe();
        }
    }
}