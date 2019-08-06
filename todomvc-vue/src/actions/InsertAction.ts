import { Action } from './Action';
import { Todo } from '@/models';

export class InsertAction extends Action {
    private readonly todo: Todo;
    constructor(todo: Todo) {
        super();
        this.todo = todo;
    }
    public doAction(todos: Todo[]) {
        return [...todos, this.todo];
    }
}
