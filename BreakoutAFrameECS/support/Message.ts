export interface Message<T> {
    tag: string;
    entity: any;
    msg: T;
}