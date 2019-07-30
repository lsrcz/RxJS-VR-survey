import {
    Observable,
    merge,
    NEVER,
    fromEvent,
    Subject,
    interval,
    animationFrameScheduler,
    of ,
    ReplaySubject,
    combineLatest,
    concat

} from 'rxjs';
import {
    map,
    filter,
    distinctUntilChanged,
    switchMap,
    startWith,
    scan,
    withLatestFrom,
    share,
    publishReplay,
    refCount,
    tap,
    mapTo,
    pairwise,
    skip,
    take,
    takeLast,
} from 'rxjs/operators';
import {
    fromJS,
    Map
} from 'immutable';
import {
    identical
} from 'ramda';


function when < T, R > (stream: Observable < T > , func: (_: T) => boolean) {
    return function whenFunc(instream: Observable < R > ): Observable < R > {
        return instream.pipe(
            withLatestFrom(stream),
            filter(([_, snd]) => func(snd)),
            map(([fst, _]) => fst)
        );
    }
}

function peek < T, R > (stream: Observable < T > ) {
    return function peekFunc(instream: Observable < R > ): Observable < T > {
        return instream.pipe(
            withLatestFrom(stream),
            map(([_, snd]) => snd)
        )
    }
}


function drawLine(sources) {
    const mousedown$ = sources['mousedown-canvas'];
    const mouseup$ = sources['mouseup'];
    const mousemove$ = sources['mousemove-canvas'];
    const mode$ = sources['mode'];

    const startPos$ = mousedown$.pipe(
        when(mode$, identical('line.ready')),
        publishReplay(),
        refCount(),
    );
    const movingPos$ = mode$.pipe(
        withLatestFrom(startPos$),
        switchMap(([e, startPos]) => {
            if (e == 'line.drawing') {
                return mousemove$.pipe(
                    startWith(startPos)
                )
            } else {
                return NEVER;
            }
        }),
        share()
    );
    const toLineDrawMode$ = startPos$.pipe(
        mapTo('line.drawing'),
        share(),
    );

    const drawing$ = mode$.pipe(
        switchMap(mode => {
            if (mode == 'line.drawing') {
                return combineLatest(startPos$, movingPos$).pipe(
                    map(([start, end]) => [{
                        start: start,
                        end: end
                    }]),
                )
            } else {
                return NEVER;
            }
        }),
        share(),
    );

    const newItem$ = mouseup$.pipe(
        when(mode$, identical('line.drawing')),
        peek(drawing$),
        share(),
    )


    const toReadyMode$ = newItem$.pipe(
        mapTo('line.ready'),
        share(),
    )

    const clearedDrawing$ = merge(
        drawing$,
        toReadyMode$.pipe(
            mapTo([])
        )
    ).pipe(
        share(),
    );


    const nextMode$ = merge(toLineDrawMode$, toReadyMode$).pipe(
        share()
    );

    return {
        newitem: newItem$,
        nextmode: nextMode$,
        drawing: clearedDrawing$
    }
}


function drawCurve(sources) {
    const mousedown$ = sources['mousedown-canvas'];
    const mouseup$ = sources['mouseup'];
    const mousemove$ = sources['mousemove-canvas'];
    const mode$ = sources['mode'];

    const startPos$ = mousedown$.pipe(
        when(mode$, identical('curve.ready')),
        tap(console.log),

        publishReplay(),
        refCount(),
    );
    const movingPos$ = mode$.pipe(
        withLatestFrom(startPos$),
        switchMap(([e, startPos]) => {
            if (e == 'curve.drawing') {
                return mousemove$.pipe(
                    startWith(startPos)
                )
            } else {
                return NEVER;
            }
        }),
        share()
    );

    const toLineDrawMode$ = startPos$.pipe(
        mapTo('curve.drawing'),
        share(),
    );

    const drawing$ = mode$.pipe(
        switchMap(mode => {
            if (mode == 'curve.drawing') {
                return movingPos$.pipe(
                    skip(1),
                    pairwise(),
                    map(([start, end]) => [{
                        start: start,
                        end: end
                    }]),
                    scan((acc, item) => {
                        return [...acc, ...item]
                    }, [])
                );
            } else {
                return NEVER;
            }
        }),
        share(),
    );

    const newItem$ = mouseup$.pipe(
        when(mode$, identical('curve.drawing')),
        peek(drawing$),
        share(),
    )


    const toReadyMode$ = newItem$.pipe(
        mapTo('curve.ready'),
        share(),
    )

    const clearedDrawing$ = merge(
        drawing$,
        toReadyMode$.pipe(
            mapTo([])
        )
    ).pipe(
        share(),
    );


    const nextMode$ = merge(toLineDrawMode$, toReadyMode$).pipe(
        share()
    );

    return {
        newitem: newItem$,
        nextmode: nextMode$,
        drawing: clearedDrawing$
    }
}

function eraser(sources) {
    const mousedown$ = sources['mousedown-canvas'];
    const mouseup$ = sources['mouseup'];
    const mousemove$ = sources['mousemove-canvas'];
    const mode$ = sources['mode'];
 

    return {
    }
}

function modeToggler(sources) {
    const lineClicked$ = sources['click-line'];
    const curveClicked$ = sources['click-curve'];

    const nextMode$ = merge(
        lineClicked$.pipe(
            mapTo('line.ready'),
        ),
        curveClicked$.pipe(
            mapTo('curve.ready'),
        )
    );

    return {
        nextmode: nextMode$,
    }
}

function main(sources) {
    const drawLineRet = drawLine(sources);
    const drawCurveRet = drawCurve(sources);
    const modeTogglerRet = modeToggler(sources);


    const newitem$ = merge(drawLineRet['newitem'], drawCurveRet['newitem']).pipe(share());
    const items$ = newitem$.pipe(
        startWith([]),
        scan((acc: Segment[], item: Segment[]) => {
            return acc.concat(item);
        }),
        share()
    );
    const mode$ = merge(drawLineRet['nextmode'], modeTogglerRet['nextmode'], drawCurveRet['nextmode']).pipe(
        startWith('idle'),
        share()
    );
    const drawing$ = (merge(drawLineRet['drawing'], drawCurveRet['drawing']) as Observable < Segment[] > ).pipe(
        share()
    );

    const allItems$ = combineLatest(drawing$, items$).pipe(
        map(([d, i]: Segment[][]) => {
            return [...d, ...i];
        }),
        share()
    )
    return {
        mode: mode$,
        items: allItems$
    };
}

function run(main) {
    const tick = interval(16, animationFrameScheduler);
    const canvasDraw = new Canvas('#stage');

    const canvas = document.querySelector('#stage');
    const mousedownCanvas$: Observable < Point > = fromEvent(canvas, 'mousedown').pipe(
        map((e: MouseEvent) => {
            return {
                x: e.clientX - (e.srcElement as HTMLElement).offsetLeft,
                y: e.clientY - (e.srcElement as HTMLElement).offsetTop
            }
        }),
        share()
    );
    const mousemoveCanvas$: Observable < Point > = fromEvent(canvas, 'mousemove').pipe(
        map((e: MouseEvent) => {
            return {
                x: e.clientX - (e.srcElement as HTMLElement).offsetLeft,
                y: e.clientY - (e.srcElement as HTMLElement).offsetTop
            }
        }),
        share()
    );
    const mouseup$ = fromEvent(document, 'mouseup');
    const btnLine = document.querySelector('#line');
    const btnCurve = document.querySelector('#curve');
    const lineClick$ = fromEvent(btnLine, 'click');
    const curveClick$ = fromEvent(btnCurve, 'click');
    const mode$ = new ReplaySubject(1);
    const items$ = new ReplaySubject(1);


    const source = {
        'mousedown-canvas': mousedownCanvas$,
        'mouseup': mouseup$,
        'mousemove-canvas': mousemoveCanvas$,
        'mode': mode$.asObservable(),
        'click-line': lineClick$,
        'click-curve': curveClick$,
        'items': items$
    }

    const ret = main(source);

    return merge(
        ret['mode'].pipe(tap(console.log), tap(e => mode$.next(e))),
        ret['items'].pipe(tap(e => items$.next(e))),

        tick.pipe(
            withLatestFrom(items$.asObservable()),
            map(([_, snd]) => snd),
            tap((e: Segment[]) => {
                console.log(e.length),
                canvasDraw.clear();
                canvasDraw.drawLines(e);
            })
        )
    ).subscribe()

}

interface Point {
    x: number;
    y: number;
}

interface Segment {
    start: Point,
    end: Point
}

class Canvas {
    private canvas: any;
    private context: CanvasRenderingContext2D;
    constructor(selector: string) {
        this.canvas = document.querySelector(selector);
        this.context = this.canvas.getContext('2d');
        this.context.fillStyle = 'pink';
    }
    clear() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    private drawSingleLine(seg: Segment) {
        this.context.beginPath();
        this.context.moveTo(seg.start.x, seg.start.y);
        this.context.lineTo(seg.end.x, seg.end.y);
        this.context.stroke()
    }
    drawLines(arr: Segment[]) {
        arr.forEach(element => {
            this.drawSingleLine(element)
        });
    }
}

run(main)