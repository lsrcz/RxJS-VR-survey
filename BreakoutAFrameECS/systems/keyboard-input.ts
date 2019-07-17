/// <reference types="@types/aframe"/>

import {
    fromEvent
} from "rxjs";
import {
    map
} from "rxjs/operators";

AFRAME.registerSystem('keyboard-input', {
    dependencies: [
        'message'
    ],
    init() {
        console.log(this.el.sceneEl.systems);
        this.keydownSubscription = this.el.sceneEl.systems.message.provideToBus(
            'keydown',
            fromEvent(document, 'keydown')
            .pipe(map((e: KeyboardEvent) => e.keyCode)));
        this.keyupSubscription = this.el.sceneEl.systems.message.provideToBus(
            'keyup',
            fromEvent(document, 'keyup'));
    },
    remove() {
    }
})