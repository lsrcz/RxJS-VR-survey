/// <reference types="@types/aframe"/>

import {
    startWith,
    scan,
    share
} from "rxjs/operators";

AFRAME.registerComponent('brickfield', {
    init() {
        if (this.el.sceneEl.hasLoaded) {
            this.initBody();
        } else {
            this.el.sceneEl.addEventListener('loaded', this.initBody.bind(this));
        }
    },
    initBody() {
        var bricks = [];
        for (let j = 0; j < 2; ++j) {
            for (let i = 0; i < 5; ++i) {
                var el = document.createElement('a-box');
                el.setAttribute('color', '#DDEED9');
                el.setAttribute('width', 4);
                el.setAttribute('height', 3);
                el.setAttribute('depth', 2);
                el.setAttribute('position', {
                    x: -5 * (i - 2),
                    y: 1.5,
                    z: -4 - j * 4
                });
                bricks.push(el);
                this.el.appendChild(el);
            }
        }
        const messageSystem = this.el.sceneEl.systems['message'];
        const cBrick = messageSystem.getStream('cbrick');

        const bricksProvider = cBrick.pipe(
            startWith(bricks),
            scan((bricks: any[], {
                idx
            }: {
                idx: number
            }) => {
                this.el.removeChild(bricks[idx]);
                bricks.splice(idx, 1);
                return bricks;
            }),
            share()
        );

        messageSystem.provideToBus('bricks', bricksProvider);
    }
})