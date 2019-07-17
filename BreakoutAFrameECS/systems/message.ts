/// <reference types="@types/aframe"/>

import {
    MessageBus
} from "../support/MessageBus";
import {
    Observable,
    Subscription,
    animationFrameScheduler,
    interval,
    fromEvent
} from "rxjs";
import {
    tap,
    map
} from "rxjs/operators";

AFRAME.registerSystem('message', {
    schema: {
        tick: {
            default: true
        },
        debug: {
            default: false
        }
    },
    init() {
        this.messageBus = new MessageBus();
    },
    debugLog(shouldDebug, entity, tag) {
        return function(e) {
            if (shouldDebug) {
                console.log(tag, entity, e);
            }
        }
    },
    provideToBus(tag: string, provider: Observable < any >, entity?: any): Subscription {
        return provider.pipe(
            tap(this.debugLog(this.data.debug, entity, tag)),
            tap(e => this.messageBus.put(tag, e, entity))
        ).subscribe();
    },
    privideToBusWithEntity(tag: string, provider: Observable<{entity: any, msg: any}>): Subscription {
        return provider.pipe(
            tap(({entity, msg}) => {
                this.debugLog(this.data.debug, entity, tag)(msg);
            }),
            tap(({entity, msg}) => this.messageBus.put(tag, msg, entity))
        ).subscribe();
    },
    getStream(tag: string, entity?: any): Observable < any > {
        return this.messageBus.subqueue(tag, entity);
    },
    tick(t, dt) {
        if (this.data.tick) {
            this.messageBus.put('global-tick', {
                t: t,
                dt: dt
            });
        }
    }
})