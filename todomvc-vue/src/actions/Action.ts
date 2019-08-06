import { Todo } from '@/models';

export abstract class Action {
    public abstract doAction(todolst: Todo[]): Todo[];
}

