import { Subject, ReplaySubject, Observable, Subscription } from "rxjs";
import { Message } from "./Message";
import { filter, map, tap } from "rxjs/operators";

export class MessageBus {
    private bus: Subject<Message<any>>;
    constructor() {
        this.bus = new ReplaySubject();
    }
    put<T>(tag: string, msg: T, entity?: any): void {
        this.bus.next({
            tag: tag,
            entity: entity,
            msg: msg
        });
    }
    subqueue(tag: string, entity?: any): Observable<any> {
        if (typeof entity == 'undefined') {
            return this.bus.asObservable().pipe(
                filter(e => e.tag == tag),
                map((e: Message<any>) => e.msg)
            );
        } else {
            return this.bus.asObservable().pipe(
                filter(e => e.tag == tag),
                filter(e => typeof e.entity == 'undefined' || e.entity == entity),
                map((e: Message<any>) => e.msg) 
            )
        }
    }
}
