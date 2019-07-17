/// <reference types="@types/aframe"/>

import { interval } from "rxjs";
import { map } from "rxjs/operators";

AFRAME.registerComponent('fake-provider', {
    schema: {
        name: { type: "string" }
    },
    init() {
        this.subscription = this.el.sceneEl.systems.message.provideToBus(this.data.name, interval(1000).pipe(map(e => {
            return {x: e};
        })));
    },
    remove() {
        this.subscription.unsubscribe();
    }
})