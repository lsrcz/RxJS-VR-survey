/// <reference types="@types/aframe"/>

import { BehaviorSubject } from 'rxjs';
import { withLatestFrom, filter, map, tap } from 'rxjs/operators';

AFRAME.registerComponent('relay', {
    multiple: true,
    schema: {
        tag: { type: "string" },
        component: { type: "string" },
    },
    init() {
        this.toggleStream = new BehaviorSubject(false);
        this.stream = this.el.sceneEl.systems.message.getStream(this.data.tag);
        this.subscription = this.stream.pipe(
            tap(console.log),
            withLatestFrom(this.toggleStream),
            filter(([_, t]) => t),
            map(([s, _]) => s),
            tap(s => this.el.setAttribute(this.data.component, s))
        ).subscribe()
    },
    remove() {
        this.subscription.unsubscribe();
    },
    play() {
        this.toggleStream.next(true);  
    },
    pause() {
        this.toggleStream.next(false);
    }
})
