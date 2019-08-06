import { Action } from './Action';
import { Todo } from '@/models';

export class RemoveAction extends Action {
    private readonly index: number;
    constructor(index: number) {
        super();
        this.index = index;
    }
    public doAction(todos: Todo[]) {
      return [...todos.slice(0, this.index),
              ...todos.slice(this.index + 1)];
    }
}
