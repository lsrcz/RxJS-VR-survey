<template>
  <section class="todoapp">
    <header class="header">
      <h1>todos</h1>
      <input
        class="new-todo"
        v-bind:value="newTodoVal"
        v-stream:keyup="inputKeyup$"
        v-stream:input="newTodoInput$"
        placeholder="What needs to be done?"
        autofocus
      />
      <!--
        v-model="newTodoTitle"

        @keyup.enter="createTodo()"

      -->
    </header>
    <!-- This section should be hidden by default and shown when there are todos -->
    <section class="main" v-if="todos.length">
      <input class="toggle-all" type="checkbox" />
      <label for="toggle-all" v-stream:click="toggleAll$">Mark all as complete</label>
      <ul class="todo-list">
        <!-- These are here just to show the structure of the list items -->
        <!-- List items should get the class `editing` when editing and `completed` when marked as completed -->
        <div v-for="(todo, index) in todosInView" v-bind:key="index">
          <todo-item
            :todo="todo"
            v-stream:toggleCompleted="{ subject: toggleCompleted$, data: index }"
            v-stream:removeSelf="{ subject: removeTodo$, data: index }"
            v-stream:changeSelf="{ subject: changeSelf$, data: index }"
          />
        </div>
      </ul>
    </section>
    <!-- This footer should hidden by default and shown when there are todos -->
    <todo-footer
      v-if="todos.length"
      :itemsLeft="remaining.length"
      :currentView="currentView"
      v-stream:clearCompleted="clearCompleted$"
    />
  </section>
</template>

<script lang="ts">
/// <reference types="@types/dom-inputevent"/>
import TodoFooter from './TodoFooter.vue';
import TodoItem from './TodoItem.vue';
import { AppState, Todo } from '../models';
import { Component, Prop, Vue } from 'vue-property-decorator';
import { Subject, merge, BehaviorSubject, ReplaySubject } from 'rxjs';
import { pluck, startWith, map, filter, withLatestFrom,
         share, mapTo, scan, publishReplay, refCount, switchMap, tap } from 'rxjs/operators';
import { Action } from '@/actions/Action';
import { InsertAction } from '../actions/InsertAction';
import { ToggleCompleteAction } from '../actions/ToggleCompleteAction';
import { ClearCompletedAction } from '../actions/ClearCompletedAction';
import { ToggleAllAction } from '../actions/ToggleAllAction';
import { RemoveAction } from '../actions/RemoveAction';
import { ChangeSelfAction } from '../actions/ChangeSelfAction';

function isCompleted(todo: Todo) {
  return todo.completed;
}
function isNotCompleted(todo: Todo) {
  return !todo.completed;
}

@Component<TodoApp>({
  components: {
    TodoItem,
    TodoFooter,
  },
  subscriptions() {
    const newTodo$ = this.newTodoInput$.pipe(
      pluck('event'),
      map((e: InputEvent) => (e.srcElement! as HTMLInputElement).value),
    );
    const newTodoVal$: Subject<string> = new Subject();
    const addTodoItem$ = this.inputKeyup$.pipe(
      filter((e) => e.event.keyCode === 13),
      withLatestFrom(newTodoVal$),
      map(([_, snd]) => snd),
      map((s) => s && s.trim()),
      filter(Boolean),
      map((e) => {
        return {
          title: e,
          completed: false,
        } as Todo;
      }),
      share(),
    );
    this.$subscribeTo(merge(newTodo$, addTodoItem$.pipe(mapTo(''))), (e) => newTodoVal$.next(e));
    const todoAction$ = merge(
      addTodoItem$.pipe(
        map((todo: Todo) => new InsertAction(todo)),
      ),
      this.toggleCompleted$.pipe(
        pluck('data'),
        map((index: number) => new ToggleCompleteAction(index)),
      ),
      this.clearCompleted$.pipe(
        mapTo(new ClearCompletedAction()),
      ),
      this.toggleAll$.pipe(
        mapTo(new ToggleAllAction()),
      ),
      this.removeTodo$.pipe(
        pluck('data'),
        map((index: number) => new RemoveAction(index)),
      ),
      this.changeSelf$.pipe(
        map(({event: {msg}, data}) => new ChangeSelfAction(data, msg)),
      ),
    );

    const todo$ = todoAction$.pipe(
      scan((acc: Todo[], action: Action) => {
        return action.doAction(acc);
      }, []),
      startWith([]),
      publishReplay(1),
      refCount(),
    );
    const completed$ = todo$.pipe(
      map((e: Todo[]) => e.filter(isCompleted)),
      publishReplay(1),
      refCount(),
    );
    const remaining$ = todo$.pipe(
      map((e: Todo[]) => e.filter(isNotCompleted)),
      publishReplay(1),
      refCount(),
    );
    const todosInView$ = this.currentView$.pipe(
      switchMap((e: string) => {
        switch (e) {
          case 'completed':
            return completed$;
          case 'active':
            return remaining$;
          case 'all':
          default:
            return todo$;
        }
      }),
      publishReplay(1),
      refCount(),
    );
    return {
      todos: todo$,
      todosInView: todosInView$,
      newTodoVal: newTodoVal$,
      remaining: remaining$,
    };
  },
})
export default class TodoApp extends Vue {
  @Prop(String) private readonly currentView!: string;
  private inputKeyup$: Subject<{event: KeyboardEvent}> = new Subject();
  private newTodoInput$: Subject<{event: InputEvent}> = new Subject();
  private removeTodo$: Subject<any> = new Subject();
  private toggleCompleted$: Subject<any> = new Subject();
  private clearCompleted$: Subject<any> = new Subject();
  private toggleAll$: Subject<any> = new Subject();
  private currentView$: Subject<string> = new ReplaySubject(1);
  private changeSelf$: Subject<{event: {msg: string}, data: number}> = new Subject();

  private mounted() {
    this.$subscribeTo(
      this.$watchAsObservable('currentView').pipe(
        pluck('newValue'),
        startWith(this.currentView),
      ),
      (e) => this.currentView$.next(e),
    );
  }
}
</script>

<style>
@import "../../node_modules/todomvc-common/base.css";
@import "../../node_modules/todomvc-app-css/index.css";
</style>
