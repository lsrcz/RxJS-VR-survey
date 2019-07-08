import { BehaviorSubject, interval, NEVER, Observable, Subject, zip, animationFrameScheduler, Operator } from "rxjs";
import { distinctUntilChanged, switchMap, withLatestFrom, map, share, tap } from "rxjs/operators";

var frameTickerInterval = 17;
var driverTickerInterval = frameTickerInterval / 2;

const control$: BehaviorSubject < boolean > = new BehaviorSubject(false);

const driverTick = control$.asObservable().pipe(
    distinctUntilChanged(),
    switchMap(isTicking => {
        return isTicking ? interval(driverTickerInterval) : NEVER;
    })
);

const frameTick$ = control$.asObservable().pipe(
    distinctUntilChanged(),
    switchMap(isTicking => {
        return isTicking ? interval(frameTickerInterval, animationFrameScheduler) : NEVER;
    })
);



export function syncWithTick < T > (v: Observable < T > ): Observable < T > {
    return driverTick.pipe(
        withLatestFrom(v),
        map(([_, v]) => v),
        share()
    );
}

function syncedInput(...args: (Observable < any > | Subject < any > )[]): Observable < any[] > {
    return zip(driverTick, ...(args.map(o => {
        if (o instanceof Subject) {
            return o.asObservable();
        }
        return o;
    }))).pipe(
        map(([x, ...args]) => args),
        share()
    );
}

function splitStream(stream: Observable < any[] > , num: number): Observable < any > [] {
    var ret: Subject < any > [] = [];
    for (var i = 0; i < num; ++i) {
        ret.push(new Subject());
    }
    stream.pipe(
        tap(arr => {
            for (var i = 0; i < num; ++i) {
                ret[i].next(arr[i]);
            }
        })
    ).subscribe();
    return ret.map(e => e.asObservable());
}

function syncedStreams(...args: (Observable < any > | Subject < any > )[]): Observable < any > [] {
    return splitStream(syncedInput(...args), args.length);
}

export function link(f: (inputs: Observable < any > []) => Observable < any > ,
    outSubject: Subject < any > ,
    ...args: (Observable < any > | Subject < any > )[]) {
    return f(
        syncedStreams(...args)
    ).pipe(
        tap(e => outSubject.next(e))
    );
}

export function setTickInterval(t: number): void {
    frameTickerInterval = t;
    driverTickerInterval = t / 2;
}

export function startTick(): void {
    control$.next(true);
}

export function stopTick(): void {
    control$.next(false);
}

export function getDriverTick(): Observable<number> {
    return driverTick;
}

export function getFrameTick(): Observable<number> {
    return frameTick$;
}

export function observeWithFrame(...args: (Observable<any>|Subject<any>)[]) {
    const frameStream$ = new Subject();
    link(([...streams]) => zip(...streams), 
        frameStream$,
        ...args
    ).subscribe();
    return getFrameTick().pipe(
        withLatestFrom(frameStream$.asObservable()),
        map(([_, t]) => t)
    );
}

