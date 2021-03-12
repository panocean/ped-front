
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function is_promise(value) {
        return value && typeof value === 'object' && typeof value.then === 'function';
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }
    function setContext(key, context) {
        get_current_component().$$.context.set(key, context);
    }
    function getContext(key) {
        return get_current_component().$$.context.get(key);
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            callbacks.slice().forEach(fn => fn(event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    function handle_promise(promise, info) {
        const token = info.token = {};
        function update(type, index, key, value) {
            if (info.token !== token)
                return;
            info.resolved = value;
            let child_ctx = info.ctx;
            if (key !== undefined) {
                child_ctx = child_ctx.slice();
                child_ctx[key] = value;
            }
            const block = type && (info.current = type)(child_ctx);
            let needs_flush = false;
            if (info.block) {
                if (info.blocks) {
                    info.blocks.forEach((block, i) => {
                        if (i !== index && block) {
                            group_outros();
                            transition_out(block, 1, 1, () => {
                                if (info.blocks[i] === block) {
                                    info.blocks[i] = null;
                                }
                            });
                            check_outros();
                        }
                    });
                }
                else {
                    info.block.d(1);
                }
                block.c();
                transition_in(block, 1);
                block.m(info.mount(), info.anchor);
                needs_flush = true;
            }
            info.block = block;
            if (info.blocks)
                info.blocks[index] = block;
            if (needs_flush) {
                flush();
            }
        }
        if (is_promise(promise)) {
            const current_component = get_current_component();
            promise.then(value => {
                set_current_component(current_component);
                update(info.then, 1, info.value, value);
                set_current_component(null);
            }, error => {
                set_current_component(current_component);
                update(info.catch, 2, info.error, error);
                set_current_component(null);
                if (!info.hasCatch) {
                    throw error;
                }
            });
            // if we previously had a then/catch block, destroy it
            if (info.current !== info.pending) {
                update(info.pending, 0);
                return true;
            }
        }
        else {
            if (info.current !== info.then) {
                update(info.then, 1, info.value, promise);
                return true;
            }
            info.resolved = promise;
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.32.3' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const url = "https://ped-back.herokuapp.com";
    // const url = "http://localhost:4000"




    // export async function getProductionSalesVolumePerYear(data = {}) {
    //   try {
    //     let response = await fetch(`${url}/plans/year/salesvolume`, {
    //       method: 'POST',
    //       headers: {
    //         'Content-type': 'application/json'
    //       },
    //       body: JSON.stringify(data)
    //     });
    //     if(!response.ok) throw new Error('Network response was not ok');
    //     let output = await response.json();
    //     // console.log(output)
    //     return output;
    //   } catch (error) {
    //     console.error('There has been a problem with your fetch operation:', error);
    //   }
    // }

    // export async function getRevenuePerYear(data = {}) {
    //   try {
    //     let response = await fetch(`${url}/plans/year/revenue`, {
    //       method: 'POST',
    //       cache: "no-cache",
    //       headers: {
    //         'Content-type': 'application/json'
    //       },
    //       body: JSON.stringify(data)
    //     });
    //     if(!response.ok) throw new Error('Network response was not ok');
    //     let output = await response.json();
    //     // console.log(output)
    //     return output;
    //   } catch (error) {
    //     console.error('There has been a problem with your fetch operation:', error);
    //   }
    // }

    // export async function getExpensePerYear(data = {}) {
    //   try {
    //     let response = await fetch(`${url}/plans/year/expense`, {
    //       method: 'POST',
    //       cache: "no-cache",
    //       headers: {
    //         'Content-type': 'application/json'
    //       },
    //       body: JSON.stringify(data)
    //     });
    //     if(!response.ok) throw new Error('Network response was not ok');
    //     let output = await response.json();
    //     // console.log(output)
    //     return output;
    //   } catch (error) {
    //     console.error('There has been a problem with your fetch operation:', error);
    //   }
    // }

    // export async function getBudgetCostPerYear(data = {}) {
    //   try {
    //     let response = await fetch(`${url}/plans/year/budget`, {
    //       method: 'POST',
    //       cache: "no-cache",
    //       headers: {
    //         'Content-type': 'application/json'
    //       },
    //       body: JSON.stringify(data)
    //     });
    //     if(!response.ok) throw new Error('Network response was not ok');
    //     let output = await response.json();
    //     // console.log(output)
    //     return output;
    //   } catch (error) {
    //     console.error('There has been a problem with your fetch operation:', error);
    //   }
    // }

    async function getAllPlans() {
      try {
        let response = await fetch(`${url}/plans`, {
          method: 'GET',
          cache: "no-cache",
          headers: {
            'Content-type': 'application/json'
          },
          // body: JSON.stringify(data)
        });
        if(!response.ok) throw new Error('Network response was not ok');
        let output = await response.json();
        // console.log(output)
        return output;
      } catch (error) {
        console.error('There has been a problem with your fetch operation:', error);
      }
    }

    // export async function getTaxPerYear(data = {}) {
    //   try {
    //     let response = await fetch(`${url}/plans/year/tax`, {
    //       method: 'POST',
    //       cache: "no-cache",
    //       headers: {
    //         'Content-type': 'application/json'
    //       },
    //       body: JSON.stringify(data)
    //     });
    //     if(!response.ok) throw new Error('Network response was not ok');
    //     let output = await response.json();
    //     // console.log(output)
    //     return output;
    //   } catch (error) {
    //     console.error('There has been a problem with your fetch operation:', error);
    //   }
    // }

    const genericData = () => new Promise(resolve => resolve([]));

    const psVolume = writable(
      genericData()
    );


    const revenue = writable(genericData());
    const expense = writable(genericData());
    const budget = writable(genericData());
    const plans = writable(getAllPlans());
    const tax = writable(genericData());

    const  productionSalesVolume = writable(0);
    const totalSalesRevenue = writable(0);
    const  totalOperatingExpense = writable(0);
    const totalTaxes = writable(0);
    const ebt = writable(0);
    const yearParam = writable(0);

    function plansContext(data){
      return data.map(x => x.year)
    }

    /* src/components/PlanTables.svelte generated by Svelte v3.32.3 */

    const { Object: Object_1 } = globals;
    const file = "src/components/PlanTables.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i][0];
    	child_ctx[5] = list[i][1];
    	child_ctx[7] = i;
    	return child_ctx;
    }

    // (18:6) {#if i !== 0}
    function create_if_block(ctx) {
    	let tr;
    	let td0;
    	let t0_value = /*norMalizeColumn*/ ctx[3](/*x*/ ctx[4]) + "";
    	let t0;
    	let t1;
    	let td1;
    	let t2_value = (/*y*/ ctx[5] === null ? "-" : /*y*/ ctx[5]) + "";
    	let t2;
    	let t3;

    	const block = {
    		c: function create() {
    			tr = element("tr");
    			td0 = element("td");
    			t0 = text(t0_value);
    			t1 = space();
    			td1 = element("td");
    			t2 = text(t2_value);
    			t3 = space();
    			attr_dev(td0, "class", "svelte-mhusye");
    			add_location(td0, file, 19, 10, 453);
    			attr_dev(td1, "class", "svelte-mhusye");
    			add_location(td1, file, 20, 10, 493);
    			attr_dev(tr, "class", "robotomono svelte-mhusye");
    			add_location(tr, file, 18, 8, 419);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, tr, anchor);
    			append_dev(tr, td0);
    			append_dev(td0, t0);
    			append_dev(tr, t1);
    			append_dev(tr, td1);
    			append_dev(td1, t2);
    			append_dev(tr, t3);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*data*/ 1 && t0_value !== (t0_value = /*norMalizeColumn*/ ctx[3](/*x*/ ctx[4]) + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*data*/ 1 && t2_value !== (t2_value = (/*y*/ ctx[5] === null ? "-" : /*y*/ ctx[5]) + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(tr);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(18:6) {#if i !== 0}",
    		ctx
    	});

    	return block;
    }

    // (17:4) {#each Object.entries(data) as [x, y], i}
    function create_each_block(ctx) {
    	let if_block_anchor;
    	let if_block = /*i*/ ctx[7] !== 0 && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*i*/ ctx[7] !== 0) if_block.p(ctx, dirty);
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(17:4) {#each Object.entries(data) as [x, y], i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let table;
    	let thead;
    	let tr;
    	let th0;
    	let t0;
    	let t1;
    	let th1;
    	let t2;
    	let t3;
    	let tbody;
    	let each_value = Object.entries(/*data*/ ctx[0]);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			table = element("table");
    			thead = element("thead");
    			tr = element("tr");
    			th0 = element("th");
    			t0 = text(/*heading1*/ ctx[1]);
    			t1 = space();
    			th1 = element("th");
    			t2 = text(/*heading2*/ ctx[2]);
    			t3 = space();
    			tbody = element("tbody");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(th0, "class", "svelte-mhusye");
    			add_location(th0, file, 11, 6, 268);
    			attr_dev(th1, "class", "svelte-mhusye");
    			add_location(th1, file, 12, 6, 294);
    			attr_dev(tr, "class", "quicksand svelte-mhusye");
    			add_location(tr, file, 10, 4, 239);
    			add_location(thead, file, 9, 2, 227);
    			add_location(tbody, file, 15, 2, 337);
    			attr_dev(table, "class", "styled-table svelte-mhusye");
    			add_location(table, file, 8, 0, 196);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, table, anchor);
    			append_dev(table, thead);
    			append_dev(thead, tr);
    			append_dev(tr, th0);
    			append_dev(th0, t0);
    			append_dev(tr, t1);
    			append_dev(tr, th1);
    			append_dev(th1, t2);
    			append_dev(table, t3);
    			append_dev(table, tbody);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(tbody, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*heading1*/ 2) set_data_dev(t0, /*heading1*/ ctx[1]);
    			if (dirty & /*heading2*/ 4) set_data_dev(t2, /*heading2*/ ctx[2]);

    			if (dirty & /*Object, data, norMalizeColumn*/ 9) {
    				each_value = Object.entries(/*data*/ ctx[0]);
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(tbody, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(table);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("PlanTables", slots, []);
    	let { data } = $$props;
    	let { heading1 } = $$props;
    	let { heading2 } = $$props;
    	const norMalizeColumn = text => text.split("_").map(x => x.replace(x[0], x[0].toUpperCase())).join(" ");
    	const writable_props = ["data", "heading1", "heading2"];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<PlanTables> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("data" in $$props) $$invalidate(0, data = $$props.data);
    		if ("heading1" in $$props) $$invalidate(1, heading1 = $$props.heading1);
    		if ("heading2" in $$props) $$invalidate(2, heading2 = $$props.heading2);
    	};

    	$$self.$capture_state = () => ({
    		data,
    		heading1,
    		heading2,
    		norMalizeColumn
    	});

    	$$self.$inject_state = $$props => {
    		if ("data" in $$props) $$invalidate(0, data = $$props.data);
    		if ("heading1" in $$props) $$invalidate(1, heading1 = $$props.heading1);
    		if ("heading2" in $$props) $$invalidate(2, heading2 = $$props.heading2);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [data, heading1, heading2, norMalizeColumn];
    }

    class PlanTables extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { data: 0, heading1: 1, heading2: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "PlanTables",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*data*/ ctx[0] === undefined && !("data" in props)) {
    			console.warn("<PlanTables> was created without expected prop 'data'");
    		}

    		if (/*heading1*/ ctx[1] === undefined && !("heading1" in props)) {
    			console.warn("<PlanTables> was created without expected prop 'heading1'");
    		}

    		if (/*heading2*/ ctx[2] === undefined && !("heading2" in props)) {
    			console.warn("<PlanTables> was created without expected prop 'heading2'");
    		}
    	}

    	get data() {
    		throw new Error("<PlanTables>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error("<PlanTables>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get heading1() {
    		throw new Error("<PlanTables>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set heading1(value) {
    		throw new Error("<PlanTables>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get heading2() {
    		throw new Error("<PlanTables>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set heading2(value) {
    		throw new Error("<PlanTables>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Nav.svelte generated by Svelte v3.32.3 */

    const file$1 = "src/components/Nav.svelte";

    function create_fragment$1(ctx) {
    	let nav;
    	let div;

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			div = element("div");
    			add_location(div, file$1, 5, 2, 124);
    			attr_dev(nav, "class", "app-nav r-mono flex-c newcross center-first svelte-2rwwv5");
    			add_location(nav, file$1, 4, 0, 64);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, nav, anchor);
    			append_dev(nav, div);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Nav", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Nav> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Nav extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Nav",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/components/Divider.svelte generated by Svelte v3.32.3 */

    const file$2 = "src/components/Divider.svelte";

    function create_fragment$2(ctx) {
    	let hr;
    	let hr_style_value;

    	const block = {
    		c: function create() {
    			hr = element("hr");
    			attr_dev(hr, "style", hr_style_value = `margin-top: ${/*margin*/ ctx[0]} `);
    			attr_dev(hr, "class", "svelte-13jktiy");
    			add_location(hr, file$2, 3, 0, 40);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, hr, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*margin*/ 1 && hr_style_value !== (hr_style_value = `margin-top: ${/*margin*/ ctx[0]} `)) {
    				attr_dev(hr, "style", hr_style_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(hr);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Divider", slots, []);
    	let { margin } = $$props;
    	const writable_props = ["margin"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Divider> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("margin" in $$props) $$invalidate(0, margin = $$props.margin);
    	};

    	$$self.$capture_state = () => ({ margin });

    	$$self.$inject_state = $$props => {
    		if ("margin" in $$props) $$invalidate(0, margin = $$props.margin);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [margin];
    }

    class Divider extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { margin: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Divider",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*margin*/ ctx[0] === undefined && !("margin" in props)) {
    			console.warn("<Divider> was created without expected prop 'margin'");
    		}
    	}

    	get margin() {
    		throw new Error("<Divider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set margin(value) {
    		throw new Error("<Divider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Badge.svelte generated by Svelte v3.32.3 */

    const file$3 = "src/components/Badge.svelte";

    function create_fragment$3(ctx) {
    	let div;
    	let p0;
    	let t0;
    	let t1;
    	let p1;
    	let span0;
    	let t2;
    	let t3;
    	let span1;
    	let t4;

    	const block = {
    		c: function create() {
    			div = element("div");
    			p0 = element("p");
    			t0 = text(/*title*/ ctx[0]);
    			t1 = space();
    			p1 = element("p");
    			span0 = element("span");
    			t2 = text(/*value*/ ctx[1]);
    			t3 = space();
    			span1 = element("span");
    			t4 = text(/*unit*/ ctx[2]);
    			attr_dev(p0, "class", "svelte-15e432a");
    			add_location(p0, file$3, 7, 2, 144);
    			attr_dev(span0, "class", "svelte-15e432a");
    			add_location(span0, file$3, 9, 4, 169);
    			attr_dev(span1, "class", "unit svelte-15e432a");
    			add_location(span1, file$3, 10, 4, 194);
    			attr_dev(p1, "class", "svelte-15e432a");
    			add_location(p1, file$3, 8, 2, 161);
    			attr_dev(div, "class", "badge flex-c svelte-15e432a");
    			add_location(div, file$3, 6, 0, 115);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, p0);
    			append_dev(p0, t0);
    			append_dev(div, t1);
    			append_dev(div, p1);
    			append_dev(p1, span0);
    			append_dev(span0, t2);
    			append_dev(p1, t3);
    			append_dev(p1, span1);
    			append_dev(span1, t4);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*title*/ 1) set_data_dev(t0, /*title*/ ctx[0]);
    			if (dirty & /*value*/ 2) set_data_dev(t2, /*value*/ ctx[1]);
    			if (dirty & /*unit*/ 4) set_data_dev(t4, /*unit*/ ctx[2]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Badge", slots, []);
    	let { title = undefined } = $$props;
    	let { value = undefined } = $$props;
    	let { unit = undefined } = $$props;
    	const writable_props = ["title", "value", "unit"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Badge> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("value" in $$props) $$invalidate(1, value = $$props.value);
    		if ("unit" in $$props) $$invalidate(2, unit = $$props.unit);
    	};

    	$$self.$capture_state = () => ({ title, value, unit });

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("value" in $$props) $$invalidate(1, value = $$props.value);
    		if ("unit" in $$props) $$invalidate(2, unit = $$props.unit);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [title, value, unit];
    }

    class Badge extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { title: 0, value: 1, unit: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Badge",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get title() {
    		throw new Error("<Badge>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<Badge>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get value() {
    		throw new Error("<Badge>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Badge>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get unit() {
    		throw new Error("<Badge>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set unit(value) {
    		throw new Error("<Badge>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Years.svelte generated by Svelte v3.32.3 */

    const file$4 = "src/components/Years.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	child_ctx[8] = i;
    	return child_ctx;
    }

    // (23:0) {#each allYears as val,i}
    function create_each_block$1(ctx) {
    	let label;
    	let t0_value = /*val*/ ctx[6] + "";
    	let t0;
    	let t1;
    	let input;
    	let input_checked_value;
    	let t2;
    	let span;
    	let t3;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[3](/*i*/ ctx[8]);
    	}

    	const block = {
    		c: function create() {
    			label = element("label");
    			t0 = text(t0_value);
    			t1 = space();
    			input = element("input");
    			t2 = space();
    			span = element("span");
    			t3 = space();
    			attr_dev(input, "type", "checkbox");
    			input.checked = input_checked_value = /*checkedVal*/ ctx[0] === /*i*/ ctx[8] ? "checked" : "";
    			add_location(input, file$4, 25, 4, 624);
    			attr_dev(span, "class", "checkmark");
    			add_location(span, file$4, 26, 4, 733);
    			attr_dev(label, "class", "container svelte-sn8mbh");
    			add_location(label, file$4, 23, 2, 584);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, label, anchor);
    			append_dev(label, t0);
    			append_dev(label, t1);
    			append_dev(label, input);
    			append_dev(label, t2);
    			append_dev(label, span);
    			append_dev(label, t3);

    			if (!mounted) {
    				dispose = listen_dev(input, "click", click_handler, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*checkedVal*/ 1 && input_checked_value !== (input_checked_value = /*checkedVal*/ ctx[0] === /*i*/ ctx[8] ? "checked" : "")) {
    				prop_dev(input, "checked", input_checked_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(label);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(23:0) {#each allYears as val,i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let each_1_anchor;
    	let each_value = /*allYears*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*checkedVal, checkThenSendVal, allYears*/ 7) {
    				each_value = /*allYears*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Years", slots, []);
    	const { allYears } = getContext("plansdata");
    	const dispatch = createEventDispatcher();
    	let checkedVal;
    	let dataParam;

    	const checkThenSendVal = data => {
    		$$invalidate(0, checkedVal = data);
    		dataParam = allYears[checkedVal];
    		dispatch("senddataparam", { param: dataParam });
    	};

    	onMount(() => {
    		$$invalidate(0, checkedVal = 0);
    		dataParam = allYears[0];
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Years> was created with unknown prop '${key}'`);
    	});

    	const click_handler = i => checkThenSendVal(i);

    	$$self.$capture_state = () => ({
    		getContext,
    		onMount,
    		createEventDispatcher,
    		allYears,
    		dispatch,
    		checkedVal,
    		dataParam,
    		checkThenSendVal
    	});

    	$$self.$inject_state = $$props => {
    		if ("checkedVal" in $$props) $$invalidate(0, checkedVal = $$props.checkedVal);
    		if ("dataParam" in $$props) dataParam = $$props.dataParam;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [checkedVal, allYears, checkThenSendVal, click_handler];
    }

    class Years extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Years",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    const getAverageProductionSalesVolume = (thisYear) => {
      const { crude_oil_sales, gas_sales } = thisYear[0].production_sales_volume;
      return crude_oil_sales + gas_sales;
    };

    const getTotalSalesRevenue = (thisYear) => {
      const { oil, gas } = thisYear[0].revenue;
      return oil + gas;
    };

    const getTotalOperatingExpense = (thisYear) => {
      const {
        royalty_liquids,
        royalty_gas,
        opex_liquids,
        opex_gas,
      } = thisYear[0].operating_expenses;
      return royalty_gas + royalty_liquids + opex_liquids + opex_gas;
    };

    const ebidta = (thisYear) => {
      return getTotalSalesRevenue(thisYear) - getTotalOperatingExpense(thisYear);
    };

    const getEbt = (thisYear) => {
      return  ebidta(thisYear) - thisYear[0].budget_cost_ratios.ppta_schedule_used;
    };

    const getTotalTaxes = (thisYear) => {
      return thisYear[0].taxes.cita_edu_gas  +  thisYear[0].taxes.ppta_edu_liquids 
    };

    const netIncome = (thisYear) => {
      return getEbt(thisYear) - getTotalTaxes(thisYear)
    };

    /* src/components/Measures.svelte generated by Svelte v3.32.3 */

    const file$5 = "src/components/Measures.svelte";

    function create_fragment$5(ctx) {
    	let div0;
    	let span;
    	let t1;
    	let divider0;
    	let t2;
    	let section0;
    	let years;
    	let t3;
    	let div1;
    	let divider1;
    	let t4;
    	let section1;
    	let badge0;
    	let t5;
    	let badge1;
    	let t6;
    	let badge2;
    	let t7;
    	let badge3;
    	let t8;
    	let badge4;
    	let current;
    	divider0 = new Divider({ $$inline: true });
    	years = new Years({ $$inline: true });
    	years.$on("senddataparam", /*senddataparam_handler*/ ctx[10]);
    	years.$on("senddataparam", /*setParam*/ ctx[5]);
    	divider1 = new Divider({ $$inline: true });

    	badge0 = new Badge({
    			props: {
    				title: "Average Production Sales Volume",
    				value: /*$productionSalesVolume*/ ctx[0],
    				unit: "kboepd"
    			},
    			$$inline: true
    		});

    	badge1 = new Badge({
    			props: {
    				title: "Total Sales Revenue",
    				value: /*$totalSalesRevenue*/ ctx[1],
    				unit: "us$/m"
    			},
    			$$inline: true
    		});

    	badge2 = new Badge({
    			props: {
    				title: "Total Operating Expense",
    				value: /*$totalOperatingExpense*/ ctx[2],
    				unit: "us$/m"
    			},
    			$$inline: true
    		});

    	badge3 = new Badge({
    			props: {
    				title: "Earnings Before Taxes",
    				value: /*$ebt*/ ctx[3],
    				unit: "us$/m"
    			},
    			$$inline: true
    		});

    	badge4 = new Badge({
    			props: {
    				title: "Total Taxes",
    				value: /*$totalTaxes*/ ctx[4],
    				unit: "us$/m"
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			span = element("span");
    			span.textContent = "Plan By Years";
    			t1 = space();
    			create_component(divider0.$$.fragment);
    			t2 = space();
    			section0 = element("section");
    			create_component(years.$$.fragment);
    			t3 = space();
    			div1 = element("div");
    			create_component(divider1.$$.fragment);
    			t4 = space();
    			section1 = element("section");
    			create_component(badge0.$$.fragment);
    			t5 = space();
    			create_component(badge1.$$.fragment);
    			t6 = space();
    			create_component(badge2.$$.fragment);
    			t7 = space();
    			create_component(badge3.$$.fragment);
    			t8 = space();
    			create_component(badge4.$$.fragment);
    			add_location(span, file$5, 56, 2, 1467);
    			attr_dev(section0, "class", "inputs svelte-1jz4z38");
    			add_location(section0, file$5, 58, 2, 1510);
    			add_location(div0, file$5, 55, 0, 1459);
    			attr_dev(section1, "class", "badges svelte-1jz4z38");
    			add_location(section1, file$5, 64, 2, 1636);
    			add_location(div1, file$5, 62, 0, 1614);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, span);
    			append_dev(div0, t1);
    			mount_component(divider0, div0, null);
    			append_dev(div0, t2);
    			append_dev(div0, section0);
    			mount_component(years, section0, null);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, div1, anchor);
    			mount_component(divider1, div1, null);
    			append_dev(div1, t4);
    			append_dev(div1, section1);
    			mount_component(badge0, section1, null);
    			append_dev(section1, t5);
    			mount_component(badge1, section1, null);
    			append_dev(section1, t6);
    			mount_component(badge2, section1, null);
    			append_dev(section1, t7);
    			mount_component(badge3, section1, null);
    			append_dev(section1, t8);
    			mount_component(badge4, section1, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const badge0_changes = {};
    			if (dirty & /*$productionSalesVolume*/ 1) badge0_changes.value = /*$productionSalesVolume*/ ctx[0];
    			badge0.$set(badge0_changes);
    			const badge1_changes = {};
    			if (dirty & /*$totalSalesRevenue*/ 2) badge1_changes.value = /*$totalSalesRevenue*/ ctx[1];
    			badge1.$set(badge1_changes);
    			const badge2_changes = {};
    			if (dirty & /*$totalOperatingExpense*/ 4) badge2_changes.value = /*$totalOperatingExpense*/ ctx[2];
    			badge2.$set(badge2_changes);
    			const badge3_changes = {};
    			if (dirty & /*$ebt*/ 8) badge3_changes.value = /*$ebt*/ ctx[3];
    			badge3.$set(badge3_changes);
    			const badge4_changes = {};
    			if (dirty & /*$totalTaxes*/ 16) badge4_changes.value = /*$totalTaxes*/ ctx[4];
    			badge4.$set(badge4_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(divider0.$$.fragment, local);
    			transition_in(years.$$.fragment, local);
    			transition_in(divider1.$$.fragment, local);
    			transition_in(badge0.$$.fragment, local);
    			transition_in(badge1.$$.fragment, local);
    			transition_in(badge2.$$.fragment, local);
    			transition_in(badge3.$$.fragment, local);
    			transition_in(badge4.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(divider0.$$.fragment, local);
    			transition_out(years.$$.fragment, local);
    			transition_out(divider1.$$.fragment, local);
    			transition_out(badge0.$$.fragment, local);
    			transition_out(badge1.$$.fragment, local);
    			transition_out(badge2.$$.fragment, local);
    			transition_out(badge3.$$.fragment, local);
    			transition_out(badge4.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			destroy_component(divider0);
    			destroy_component(years);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div1);
    			destroy_component(divider1);
    			destroy_component(badge0);
    			destroy_component(badge1);
    			destroy_component(badge2);
    			destroy_component(badge3);
    			destroy_component(badge4);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let $plans;
    	let $yearParam;
    	let $productionSalesVolume;
    	let $totalSalesRevenue;
    	let $totalOperatingExpense;
    	let $ebt;
    	let $totalTaxes;
    	validate_store(plans, "plans");
    	component_subscribe($$self, plans, $$value => $$invalidate(8, $plans = $$value));
    	validate_store(yearParam, "yearParam");
    	component_subscribe($$self, yearParam, $$value => $$invalidate(9, $yearParam = $$value));
    	validate_store(productionSalesVolume, "productionSalesVolume");
    	component_subscribe($$self, productionSalesVolume, $$value => $$invalidate(0, $productionSalesVolume = $$value));
    	validate_store(totalSalesRevenue, "totalSalesRevenue");
    	component_subscribe($$self, totalSalesRevenue, $$value => $$invalidate(1, $totalSalesRevenue = $$value));
    	validate_store(totalOperatingExpense, "totalOperatingExpense");
    	component_subscribe($$self, totalOperatingExpense, $$value => $$invalidate(2, $totalOperatingExpense = $$value));
    	validate_store(ebt, "ebt");
    	component_subscribe($$self, ebt, $$value => $$invalidate(3, $ebt = $$value));
    	validate_store(totalTaxes, "totalTaxes");
    	component_subscribe($$self, totalTaxes, $$value => $$invalidate(4, $totalTaxes = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Measures", slots, []);
    	let year;
    	let aYearData;
    	let fullData;

    	const setParam = async e => {
    		yearParam.set(e.detail.param);
    		fullData = await $plans;
    		$$invalidate(6, year = $yearParam);
    		$$invalidate(7, aYearData = fullData.filter(x => x.year === year));
    		productionSalesVolume.set(getAverageProductionSalesVolume(aYearData));
    		totalOperatingExpense.set(getTotalOperatingExpense(aYearData));
    		totalSalesRevenue.set(getTotalSalesRevenue(aYearData));
    		ebt.set(getEbt(aYearData));
    		totalTaxes.set(getTotalTaxes(aYearData));
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Measures> was created with unknown prop '${key}'`);
    	});

    	function senddataparam_handler(event) {
    		bubble($$self, event);
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		Badge,
    		Divider,
    		Years,
    		plans,
    		productionSalesVolume,
    		totalSalesRevenue,
    		totalOperatingExpense,
    		totalTaxes,
    		ebt,
    		yearParam,
    		getAverageProductionSalesVolume,
    		getTotalOperatingExpense,
    		getTotalSalesRevenue,
    		getEbt,
    		getTotalTaxes,
    		year,
    		aYearData,
    		fullData,
    		setParam,
    		$plans,
    		$yearParam,
    		$productionSalesVolume,
    		$totalSalesRevenue,
    		$totalOperatingExpense,
    		$ebt,
    		$totalTaxes
    	});

    	$$self.$inject_state = $$props => {
    		if ("year" in $$props) $$invalidate(6, year = $$props.year);
    		if ("aYearData" in $$props) $$invalidate(7, aYearData = $$props.aYearData);
    		if ("fullData" in $$props) fullData = $$props.fullData;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$plans, $yearParam, year, aYearData*/ 960) {
    			onMount(async () => {
    				let data = await $plans;
    				fullData = data;
    				$$invalidate(6, year = $yearParam);
    				$$invalidate(7, aYearData = data.filter(x => x.year === year));
    				productionSalesVolume.set(getAverageProductionSalesVolume(aYearData));
    				totalOperatingExpense.set(getTotalOperatingExpense(aYearData));
    				totalSalesRevenue.set(getTotalSalesRevenue(aYearData));
    				ebt.set(getEbt(aYearData));
    				totalTaxes.set(getTotalTaxes(aYearData));
    			});
    		}
    	};

    	return [
    		$productionSalesVolume,
    		$totalSalesRevenue,
    		$totalOperatingExpense,
    		$ebt,
    		$totalTaxes,
    		setParam,
    		year,
    		aYearData,
    		$plans,
    		$yearParam,
    		senddataparam_handler
    	];
    }

    class Measures extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Measures",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src/components/Sider.svelte generated by Svelte v3.32.3 */
    const file$6 = "src/components/Sider.svelte";

    function create_fragment$6(ctx) {
    	let div;
    	let measure;
    	let current;
    	measure = new Measures({ $$inline: true });
    	measure.$on("senddataparam", /*senddataparam_handler*/ ctx[0]);

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(measure.$$.fragment);
    			add_location(div, file$6, 5, 2, 66);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(measure, div, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(measure.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(measure.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(measure);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Sider", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Sider> was created with unknown prop '${key}'`);
    	});

    	function senddataparam_handler(event) {
    		bubble($$self, event);
    	}

    	$$self.$capture_state = () => ({ Measure: Measures });
    	return [senddataparam_handler];
    }

    class Sider extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Sider",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src/components/TopTable.svelte generated by Svelte v3.32.3 */

    const { console: console_1 } = globals;

    const file$7 = "src/components/TopTable.svelte";

    function create_fragment$7(ctx) {
    	let div;
    	let svg;

    	const block = {
    		c: function create() {
    			div = element("div");
    			svg = svg_element("svg");
    			attr_dev(svg, "class", "svelte-mczlps");
    			add_location(svg, file$7, 136, 2, 3301);
    			attr_dev(div, "id", "test1");
    			attr_dev(div, "class", "svelte-mczlps");
    			add_location(div, file$7, 135, 0, 3282);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, svg);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("TopTable", slots, []);
    	let { fullData } = $$props;
    	const { allYears } = getContext("plansdata");
    	const aYearData = (year, values) => values.filter(x => x.year === year);
    	let yearsMap = new Map();

    	for (const iterator of allYears) {
    		yearsMap.set(iterator, aYearData(iterator, fullData));
    	}

    	const graphs = [
    		{
    			key: "Average Daily Sales Volume",
    			values: [...yearsMap].map(([year, data]) => {
    				return {
    					x: year,
    					y: getAverageProductionSalesVolume(data)
    				};
    			})
    		},
    		{
    			key: "Total Sales Revenue",
    			values: [...yearsMap].map(([year, data]) => {
    				return { x: year, y: getTotalSalesRevenue(data) };
    			})
    		},
    		{
    			key: "Total Operating Expense",
    			values: [...yearsMap].map(([year, data]) => {
    				return {
    					x: year,
    					y: getTotalOperatingExpense(data)
    				};
    			})
    		},
    		{
    			key: "Earnings Before Taxes",
    			values: [...yearsMap].map(([year, data]) => {
    				return { x: year, y: getEbt(data) };
    			})
    		},
    		{
    			key: "Total Taxes",
    			values: [...yearsMap].map(([year, data]) => {
    				return { x: year, y: getTotalTaxes(data) };
    			})
    		}
    	];

    	let graphSlotWidth;
    	let graphSlotHeight;

    	onMount(() => {
    		graphSlotWidth = document.getElementById("graph-col").offsetWidth;
    		graphSlotHeight = document.getElementById("graph-col").offsetHeight;
    	});

    	// function plot() {
    	//   // d3.select('svg').remove()
    	//   nv.addGraph({
    	//     generate: function () {
    	//       var width = graphSlotWidth,
    	//         height = graphSlotHeight;
    	//       var chart = nv.models
    	//         .multiBarChart()
    	//         .width(width)
    	//         .height(height)
    	//         .stacked(true);
    	//       chart.dispatch.on("renderEnd", function () {
    	//         console.log("Render Complete");
    	//       });
    	//       var svg = d3.select("#test1 svg").datum(graphs);
    	//       console.log("calling chart");
    	//       svg.transition().duration(0).call(chart);
    	//       return chart;
    	//     },
    	//     callback: function (graph) {
    	//       nv.utils.windowResize(function () {
    	//         var width = graphSlotWidth;
    	//         var height = graphSlotHeight;
    	//         graph.width(width).height(height);
    	//         d3.select("#test1 svg")
    	//           .attr("width", width)
    	//           .attr("height", height)
    	//           .transition()
    	//           .duration(0)
    	//           .call(graph);
    	//       });
    	//     },
    	//   });
    	// }
    	// plot();
    	// window.addEventListener("resize", function () {
    	//   plot();
    	// });
    	// d3.select('svg').remove()
    	nv.addGraph(function () {
    		var chart = nv.models.multiBarChart().stacked(true);

    		chart.dispatch.on("renderEnd", function () {
    			console.log("Render Complete");
    		});

    		d3.select("#test1 svg").datum(graphs).call(chart);

    		nv.utils.windowResize(function () {
    			chart.update();
    		});

    		return chart;
    	});

    	const writable_props = ["fullData"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<TopTable> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("fullData" in $$props) $$invalidate(0, fullData = $$props.fullData);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		getContext,
    		getAverageProductionSalesVolume,
    		getTotalOperatingExpense,
    		getTotalSalesRevenue,
    		getEbt,
    		getTotalTaxes,
    		fullData,
    		allYears,
    		aYearData,
    		yearsMap,
    		graphs,
    		graphSlotWidth,
    		graphSlotHeight
    	});

    	$$self.$inject_state = $$props => {
    		if ("fullData" in $$props) $$invalidate(0, fullData = $$props.fullData);
    		if ("yearsMap" in $$props) yearsMap = $$props.yearsMap;
    		if ("graphSlotWidth" in $$props) graphSlotWidth = $$props.graphSlotWidth;
    		if ("graphSlotHeight" in $$props) graphSlotHeight = $$props.graphSlotHeight;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [fullData];
    }

    class TopTable extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, { fullData: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TopTable",
    			options,
    			id: create_fragment$7.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*fullData*/ ctx[0] === undefined && !("fullData" in props)) {
    			console_1.warn("<TopTable> was created without expected prop 'fullData'");
    		}
    	}

    	get fullData() {
    		throw new Error("<TopTable>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fullData(value) {
    		throw new Error("<TopTable>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Card.svelte generated by Svelte v3.32.3 */

    const file$8 = "src/components/Card.svelte";

    function create_fragment$8(ctx) {
    	let main;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[1].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

    	const block = {
    		c: function create() {
    			main = element("main");
    			if (default_slot) default_slot.c();
    			attr_dev(main, "id", "graph-col");
    			attr_dev(main, "class", "svelte-aw5cd8");
    			add_location(main, file$8, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);

    			if (default_slot) {
    				default_slot.m(main, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && dirty & /*$$scope*/ 1) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[0], dirty, null, null);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Card", slots, ['default']);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Card> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("$$scope" in $$props) $$invalidate(0, $$scope = $$props.$$scope);
    	};

    	return [$$scope, slots];
    }

    class Card extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Card",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    /* src/components/Net.svelte generated by Svelte v3.32.3 */
    const file$9 = "src/components/Net.svelte";

    function create_fragment$9(ctx) {
    	let div;
    	let svg;

    	const block = {
    		c: function create() {
    			div = element("div");
    			svg = svg_element("svg");
    			attr_dev(svg, "class", "svelte-t7rmx2");
    			add_location(svg, file$9, 61, 2, 1793);
    			attr_dev(div, "id", "chart");
    			attr_dev(div, "class", "svelte-t7rmx2");
    			add_location(div, file$9, 60, 0, 1774);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, svg);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Net", slots, []);
    	let { fullData } = $$props;
    	const { allYears } = getContext("plansdata");
    	const aYearData = (year, values) => values.filter(x => x.year === year);
    	let yearsMap = new Map();

    	for (const iterator of allYears) {
    		yearsMap.set(iterator, aYearData(iterator, fullData));
    	}

    	const graphs = [
    		{
    			key: "Net Income",
    			values: [...yearsMap].map(([year, data]) => {
    				return { x: year, y: netIncome(data) };
    			})
    		}
    	];

    	nv.addGraph(function () {
    		var chart = nv.models.lineChart().margin({ left: 70 }).useInteractiveGuideline(true).// .transitionDuration(350) //how fast do you want the lines to transition?
    		showLegend(true).showYAxis(true).showXAxis(true); //Adjust chart margins to give the x-axis some breathing room.
    		//We want nice looking tooltips and a guideline!
    		//Show the legend, allowing users to turn on/off line series.
    		//Show the y-axis
    		//Show the x-axis

    		chart.xAxis.axisLabel("Year"); //Chart x-axis settings

    		// .tickFormat(d3.format(",r"));
    		chart.yAxis.axisLabel("Income (us$/m)").tickFormat(d3.format(".02f")); //Chart y-axis settings

    		/* Done setting the chart up? Time to render it!*/
    		// var myData = sinAndCos(); //You need data...
    		d3.select("#chart svg").datum(graphs).call(chart); //Select the <svg> element you want to render the chart in.
    		//Populate the <svg> element with chart data...
    		//Finally, render the chart!

    		//Update the chart when window resizes.
    		nv.utils.windowResize(function () {
    			chart.update();
    		});

    		return chart;
    	});

    	const writable_props = ["fullData"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Net> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("fullData" in $$props) $$invalidate(0, fullData = $$props.fullData);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		getContext,
    		netIncome,
    		fullData,
    		allYears,
    		aYearData,
    		yearsMap,
    		graphs
    	});

    	$$self.$inject_state = $$props => {
    		if ("fullData" in $$props) $$invalidate(0, fullData = $$props.fullData);
    		if ("yearsMap" in $$props) yearsMap = $$props.yearsMap;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [fullData];
    }

    class Net extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, { fullData: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Net",
    			options,
    			id: create_fragment$9.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*fullData*/ ctx[0] === undefined && !("fullData" in props)) {
    			console.warn("<Net> was created without expected prop 'fullData'");
    		}
    	}

    	get fullData() {
    		throw new Error("<Net>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fullData(value) {
    		throw new Error("<Net>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Loader.svelte generated by Svelte v3.32.3 */

    const file$a = "src/components/Loader.svelte";

    function create_fragment$a(ctx) {
    	let main;
    	let div3;
    	let div0;
    	let div1;
    	let div2;

    	const block = {
    		c: function create() {
    			main = element("main");
    			div3 = element("div");
    			div0 = element("div");
    			div1 = element("div");
    			div2 = element("div");
    			attr_dev(div0, "class", "svelte-ywbh26");
    			add_location(div0, file$a, 3, 28, 52);
    			attr_dev(div1, "class", "svelte-ywbh26");
    			add_location(div1, file$a, 3, 39, 63);
    			attr_dev(div2, "class", "svelte-ywbh26");
    			add_location(div2, file$a, 3, 50, 74);
    			attr_dev(div3, "class", "lds-facebook svelte-ywbh26");
    			add_location(div3, file$a, 3, 2, 26);
    			attr_dev(main, "class", "flex-c svelte-ywbh26");
    			add_location(main, file$a, 2, 0, 2);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div3);
    			append_dev(div3, div0);
    			append_dev(div3, div1);
    			append_dev(div3, div2);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Loader", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Loader> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Loader extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Loader",
    			options,
    			id: create_fragment$a.name
    		});
    	}
    }

    // 0: {_id: "603185377644bebddd1d233e", year: 2021, production_sales_volume: {…}, __v: 0, revenue: {…}, …}
    // 1: {_id: "603187da7644bebddd1d2353", year: 2022, production_sales_volume: {…}, __v: 0, revenue: {…}, …}
    // 2: {_id: "603189b97644bebddd1d2368", year: 2023, production_sales_volume: {…}, __v: 0, revenue: {…}, …}
    // 3: {_id: "60318dad7644bebddd1d237d", year: 2024, production_sales_volume: {…}, __v: 0, revenue: {…}, …}

    const getProductionSalesVolumePerYear = (year, data) => {
       let reducedArray = data.filter(entry => entry.year === year );
       return reducedArray[0].production_sales_volume
    };

    const getRevenuePerYear = (year, data) => {
      let reducedArray = data.filter(entry => entry.year === year );
       return reducedArray[0].revenue
    };

    const getExpensePerYear = (year, data) => {
      let reducedArray = data.filter(entry => entry.year === year );
       return reducedArray[0].operating_expenses
    };

    const getBudgetCostPerYear = (year, data) => {
      let reducedArray = data.filter(entry => entry.year === year );
       return reducedArray[0].budget_cost_ratios
    };

    const getTaxPerYear = (year, data) => {
      let reducedArray = data.filter(entry => entry.year === year );
       return reducedArray[0].taxes
    };

    /* src/App.svelte generated by Svelte v3.32.3 */

    const { console: console_1$1 } = globals;

    const file$b = "src/App.svelte";

    // (71:0) {:else}
    function create_else_block(ctx) {
    	let await_block_anchor;
    	let promise;
    	let current;

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block,
    		then: create_then_block,
    		catch: create_catch_block_5,
    		value: 2,
    		blocks: [,,,]
    	};

    	handle_promise(promise = /*$plans*/ ctx[1], info);

    	const block = {
    		c: function create() {
    			await_block_anchor = empty();
    			info.block.c();
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, await_block_anchor, anchor);
    			info.block.m(target, info.anchor = anchor);
    			info.mount = () => await_block_anchor.parentNode;
    			info.anchor = await_block_anchor;
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			info.ctx = ctx;

    			if (dirty & /*$plans*/ 2 && promise !== (promise = /*$plans*/ ctx[1]) && handle_promise(promise, info)) ; else {
    				const child_ctx = ctx.slice();
    				child_ctx[2] = info.resolved;
    				info.block.p(child_ctx, dirty);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(info.block);
    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < 3; i += 1) {
    				const block = info.blocks[i];
    				transition_out(block);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(await_block_anchor);
    			info.block.d(detaching);
    			info.token = null;
    			info = null;
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(71:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (69:0) {#if loading}
    function create_if_block$1(ctx) {
    	let loader;
    	let current;
    	loader = new Loader({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(loader.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(loader, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(loader.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(loader.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(loader, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(69:0) {#if loading}",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import {     psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }
    function create_catch_block_5(ctx) {
    	const block = {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block_5.name,
    		type: "catch",
    		source: "(1:0) <script>   import {     psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }",
    		ctx
    	});

    	return block;
    }

    // (72:27)      <span style="display:none;"       >{setContext("plansdata", {         allYears: plansContext(data),         fullData: data,       }
    function create_then_block(ctx) {
    	let span;

    	let t0_value = setContext("plansdata", {
    		allYears: plansContext(/*data*/ ctx[2]),
    		fullData: /*data*/ ctx[2]
    	}) + "";

    	let t0;
    	let t1;
    	let main;
    	let section0;
    	let card0;
    	let t2;
    	let divider;
    	let t3;
    	let card1;
    	let t4;
    	let section1;
    	let sider;
    	let t5;
    	let section2;
    	let promise;
    	let t6;
    	let promise_1;
    	let t7;
    	let promise_2;
    	let t8;
    	let promise_3;
    	let t9;
    	let promise_4;
    	let current;

    	card0 = new Card({
    			props: {
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	divider = new Divider({
    			props: { margin: "30px" },
    			$$inline: true
    		});

    	card1 = new Card({
    			props: {
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	sider = new Sider({ $$inline: true });
    	sider.$on("senddataparam", /*changeParam*/ ctx[9]);

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block_5,
    		then: create_then_block_5,
    		catch: create_catch_block_4,
    		value: 2,
    		blocks: [,,,]
    	};

    	handle_promise(promise = /*$psVolume*/ ctx[4], info);

    	let info_1 = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block_4,
    		then: create_then_block_4,
    		catch: create_catch_block_3,
    		value: 2,
    		blocks: [,,,]
    	};

    	handle_promise(promise_1 = /*$revenue*/ ctx[5], info_1);

    	let info_2 = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block_3,
    		then: create_then_block_3,
    		catch: create_catch_block_2,
    		value: 2,
    		blocks: [,,,]
    	};

    	handle_promise(promise_2 = /*$expense*/ ctx[6], info_2);

    	let info_3 = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block_2,
    		then: create_then_block_2,
    		catch: create_catch_block_1,
    		value: 2,
    		blocks: [,,,]
    	};

    	handle_promise(promise_3 = /*$budget*/ ctx[7], info_3);

    	let info_4 = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block_1,
    		then: create_then_block_1,
    		catch: create_catch_block,
    		value: 2,
    		blocks: [,,,]
    	};

    	handle_promise(promise_4 = /*$tax*/ ctx[8], info_4);

    	const block = {
    		c: function create() {
    			span = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			main = element("main");
    			section0 = element("section");
    			create_component(card0.$$.fragment);
    			t2 = space();
    			create_component(divider.$$.fragment);
    			t3 = space();
    			create_component(card1.$$.fragment);
    			t4 = space();
    			section1 = element("section");
    			create_component(sider.$$.fragment);
    			t5 = space();
    			section2 = element("section");
    			info.block.c();
    			t6 = space();
    			info_1.block.c();
    			t7 = space();
    			info_2.block.c();
    			t8 = space();
    			info_3.block.c();
    			t9 = space();
    			info_4.block.c();
    			set_style(span, "display", "none");
    			add_location(span, file$b, 72, 4, 2045);
    			attr_dev(section0, "class", "middle flex-c svelte-112fmhv");
    			add_location(section0, file$b, 79, 6, 2223);
    			attr_dev(section1, "class", "sider svelte-112fmhv");
    			add_location(section1, file$b, 90, 6, 2529);
    			attr_dev(section2, "class", "last flex-c svelte-112fmhv");
    			add_location(section2, file$b, 94, 6, 2626);
    			attr_dev(main, "class", "flex-r svelte-112fmhv");
    			add_location(main, file$b, 78, 4, 2195);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, main, anchor);
    			append_dev(main, section0);
    			mount_component(card0, section0, null);
    			append_dev(section0, t2);
    			mount_component(divider, section0, null);
    			append_dev(section0, t3);
    			mount_component(card1, section0, null);
    			append_dev(main, t4);
    			append_dev(main, section1);
    			mount_component(sider, section1, null);
    			append_dev(main, t5);
    			append_dev(main, section2);
    			info.block.m(section2, info.anchor = null);
    			info.mount = () => section2;
    			info.anchor = t6;
    			append_dev(section2, t6);
    			info_1.block.m(section2, info_1.anchor = null);
    			info_1.mount = () => section2;
    			info_1.anchor = t7;
    			append_dev(section2, t7);
    			info_2.block.m(section2, info_2.anchor = null);
    			info_2.mount = () => section2;
    			info_2.anchor = t8;
    			append_dev(section2, t8);
    			info_3.block.m(section2, info_3.anchor = null);
    			info_3.mount = () => section2;
    			info_3.anchor = t9;
    			append_dev(section2, t9);
    			info_4.block.m(section2, info_4.anchor = null);
    			info_4.mount = () => section2;
    			info_4.anchor = null;
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if ((!current || dirty & /*$plans*/ 2) && t0_value !== (t0_value = setContext("plansdata", {
    				allYears: plansContext(/*data*/ ctx[2]),
    				fullData: /*data*/ ctx[2]
    			}) + "")) set_data_dev(t0, t0_value);

    			const card0_changes = {};

    			if (dirty & /*$$scope, $plans*/ 1026) {
    				card0_changes.$$scope = { dirty, ctx };
    			}

    			card0.$set(card0_changes);
    			const card1_changes = {};

    			if (dirty & /*$$scope, $plans*/ 1026) {
    				card1_changes.$$scope = { dirty, ctx };
    			}

    			card1.$set(card1_changes);
    			info.ctx = ctx;

    			if (dirty & /*$psVolume*/ 16 && promise !== (promise = /*$psVolume*/ ctx[4]) && handle_promise(promise, info)) ; else {
    				const child_ctx = ctx.slice();
    				child_ctx[2] = info.resolved;
    				info.block.p(child_ctx, dirty);
    			}

    			info_1.ctx = ctx;

    			if (dirty & /*$revenue*/ 32 && promise_1 !== (promise_1 = /*$revenue*/ ctx[5]) && handle_promise(promise_1, info_1)) ; else {
    				const child_ctx = ctx.slice();
    				child_ctx[2] = info_1.resolved;
    				info_1.block.p(child_ctx, dirty);
    			}

    			info_2.ctx = ctx;

    			if (dirty & /*$expense*/ 64 && promise_2 !== (promise_2 = /*$expense*/ ctx[6]) && handle_promise(promise_2, info_2)) ; else {
    				const child_ctx = ctx.slice();
    				child_ctx[2] = info_2.resolved;
    				info_2.block.p(child_ctx, dirty);
    			}

    			info_3.ctx = ctx;

    			if (dirty & /*$budget*/ 128 && promise_3 !== (promise_3 = /*$budget*/ ctx[7]) && handle_promise(promise_3, info_3)) ; else {
    				const child_ctx = ctx.slice();
    				child_ctx[2] = info_3.resolved;
    				info_3.block.p(child_ctx, dirty);
    			}

    			info_4.ctx = ctx;

    			if (dirty & /*$tax*/ 256 && promise_4 !== (promise_4 = /*$tax*/ ctx[8]) && handle_promise(promise_4, info_4)) ; else {
    				const child_ctx = ctx.slice();
    				child_ctx[2] = info_4.resolved;
    				info_4.block.p(child_ctx, dirty);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(card0.$$.fragment, local);
    			transition_in(divider.$$.fragment, local);
    			transition_in(card1.$$.fragment, local);
    			transition_in(sider.$$.fragment, local);
    			transition_in(info.block);
    			transition_in(info_1.block);
    			transition_in(info_2.block);
    			transition_in(info_3.block);
    			transition_in(info_4.block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(card0.$$.fragment, local);
    			transition_out(divider.$$.fragment, local);
    			transition_out(card1.$$.fragment, local);
    			transition_out(sider.$$.fragment, local);

    			for (let i = 0; i < 3; i += 1) {
    				const block = info.blocks[i];
    				transition_out(block);
    			}

    			for (let i = 0; i < 3; i += 1) {
    				const block = info_1.blocks[i];
    				transition_out(block);
    			}

    			for (let i = 0; i < 3; i += 1) {
    				const block = info_2.blocks[i];
    				transition_out(block);
    			}

    			for (let i = 0; i < 3; i += 1) {
    				const block = info_3.blocks[i];
    				transition_out(block);
    			}

    			for (let i = 0; i < 3; i += 1) {
    				const block = info_4.blocks[i];
    				transition_out(block);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(main);
    			destroy_component(card0);
    			destroy_component(divider);
    			destroy_component(card1);
    			destroy_component(sider);
    			info.block.d();
    			info.token = null;
    			info = null;
    			info_1.block.d();
    			info_1.token = null;
    			info_1 = null;
    			info_2.block.d();
    			info_2.token = null;
    			info_2 = null;
    			info_3.block.d();
    			info_3.token = null;
    			info_3 = null;
    			info_4.block.d();
    			info_4.token = null;
    			info_4 = null;
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block.name,
    		type: "then",
    		source: "(72:27)      <span style=\\\"display:none;\\\"       >{setContext(\\\"plansdata\\\", {         allYears: plansContext(data),         fullData: data,       }",
    		ctx
    	});

    	return block;
    }

    // (81:8) <Card>
    function create_default_slot_1(ctx) {
    	let toptable;
    	let current;

    	toptable = new TopTable({
    			props: { fullData: /*data*/ ctx[2] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(toptable.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(toptable, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const toptable_changes = {};
    			if (dirty & /*$plans*/ 2) toptable_changes.fullData = /*data*/ ctx[2];
    			toptable.$set(toptable_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(toptable.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(toptable.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(toptable, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(81:8) <Card>",
    		ctx
    	});

    	return block;
    }

    // (85:8) <Card>
    function create_default_slot(ctx) {
    	let net;
    	let current;

    	net = new Net({
    			props: { fullData: /*data*/ ctx[2] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(net.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(net, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const net_changes = {};
    			if (dirty & /*$plans*/ 2) net_changes.fullData = /*data*/ ctx[2];
    			net.$set(net_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(net.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(net.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(net, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(85:8) <Card>",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import {     psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }
    function create_catch_block_4(ctx) {
    	const block = {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block_4.name,
    		type: "catch",
    		source: "(1:0) <script>   import {     psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }",
    		ctx
    	});

    	return block;
    }

    // (96:36)            <PlanTables             {data}
    function create_then_block_5(ctx) {
    	let plantables;
    	let current;

    	plantables = new PlanTables({
    			props: {
    				data: /*data*/ ctx[2],
    				heading1: "Production & Sales Volume ",
    				heading2: /*dataParam*/ ctx[0]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(plantables.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(plantables, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const plantables_changes = {};
    			if (dirty & /*$psVolume*/ 16) plantables_changes.data = /*data*/ ctx[2];
    			if (dirty & /*dataParam*/ 1) plantables_changes.heading2 = /*dataParam*/ ctx[0];
    			plantables.$set(plantables_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(plantables.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(plantables.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(plantables, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block_5.name,
    		type: "then",
    		source: "(96:36)            <PlanTables             {data}",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import {     psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }
    function create_pending_block_5(ctx) {
    	const block = {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block_5.name,
    		type: "pending",
    		source: "(1:0) <script>   import {     psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import {     psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }
    function create_catch_block_3(ctx) {
    	const block = {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block_3.name,
    		type: "catch",
    		source: "(1:0) <script>   import {     psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }",
    		ctx
    	});

    	return block;
    }

    // (103:35)            <PlanTables {data}
    function create_then_block_4(ctx) {
    	let plantables;
    	let current;

    	plantables = new PlanTables({
    			props: {
    				data: /*data*/ ctx[2],
    				heading1: "Revenue",
    				heading2: /*dataParam*/ ctx[0]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(plantables.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(plantables, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const plantables_changes = {};
    			if (dirty & /*$revenue*/ 32) plantables_changes.data = /*data*/ ctx[2];
    			if (dirty & /*dataParam*/ 1) plantables_changes.heading2 = /*dataParam*/ ctx[0];
    			plantables.$set(plantables_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(plantables.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(plantables.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(plantables, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block_4.name,
    		type: "then",
    		source: "(103:35)            <PlanTables {data}",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import {     psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }
    function create_pending_block_4(ctx) {
    	const block = {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block_4.name,
    		type: "pending",
    		source: "(1:0) <script>   import {     psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import {     psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }
    function create_catch_block_2(ctx) {
    	const block = {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block_2.name,
    		type: "catch",
    		source: "(1:0) <script>   import {     psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }",
    		ctx
    	});

    	return block;
    }

    // (106:35)            <PlanTables             {data}
    function create_then_block_3(ctx) {
    	let plantables;
    	let current;

    	plantables = new PlanTables({
    			props: {
    				data: /*data*/ ctx[2],
    				heading1: "Operating Expenses",
    				heading2: /*dataParam*/ ctx[0]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(plantables.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(plantables, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const plantables_changes = {};
    			if (dirty & /*$expense*/ 64) plantables_changes.data = /*data*/ ctx[2];
    			if (dirty & /*dataParam*/ 1) plantables_changes.heading2 = /*dataParam*/ ctx[0];
    			plantables.$set(plantables_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(plantables.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(plantables.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(plantables, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block_3.name,
    		type: "then",
    		source: "(106:35)            <PlanTables             {data}",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import {     psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }
    function create_pending_block_3(ctx) {
    	const block = {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block_3.name,
    		type: "pending",
    		source: "(1:0) <script>   import {     psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import {     psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }
    function create_catch_block_1(ctx) {
    	const block = {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block_1.name,
    		type: "catch",
    		source: "(1:0) <script>   import {     psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }",
    		ctx
    	});

    	return block;
    }

    // (113:34)            <PlanTables             {data}
    function create_then_block_2(ctx) {
    	let plantables;
    	let current;

    	plantables = new PlanTables({
    			props: {
    				data: /*data*/ ctx[2],
    				heading1: "Budget & Cost Ratios",
    				heading2: /*dataParam*/ ctx[0]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(plantables.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(plantables, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const plantables_changes = {};
    			if (dirty & /*$budget*/ 128) plantables_changes.data = /*data*/ ctx[2];
    			if (dirty & /*dataParam*/ 1) plantables_changes.heading2 = /*dataParam*/ ctx[0];
    			plantables.$set(plantables_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(plantables.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(plantables.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(plantables, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block_2.name,
    		type: "then",
    		source: "(113:34)            <PlanTables             {data}",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import {     psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }
    function create_pending_block_2(ctx) {
    	const block = {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block_2.name,
    		type: "pending",
    		source: "(1:0) <script>   import {     psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import {     psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }
    function create_catch_block(ctx) {
    	const block = {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block.name,
    		type: "catch",
    		source: "(1:0) <script>   import {     psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }",
    		ctx
    	});

    	return block;
    }

    // (120:31)            <PlanTables {data}
    function create_then_block_1(ctx) {
    	let plantables;
    	let current;

    	plantables = new PlanTables({
    			props: {
    				data: /*data*/ ctx[2],
    				heading1: "Taxes",
    				heading2: /*dataParam*/ ctx[0]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(plantables.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(plantables, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const plantables_changes = {};
    			if (dirty & /*$tax*/ 256) plantables_changes.data = /*data*/ ctx[2];
    			if (dirty & /*dataParam*/ 1) plantables_changes.heading2 = /*dataParam*/ ctx[0];
    			plantables.$set(plantables_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(plantables.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(plantables.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(plantables, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block_1.name,
    		type: "then",
    		source: "(120:31)            <PlanTables {data}",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import {     psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }
    function create_pending_block_1(ctx) {
    	const block = {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block_1.name,
    		type: "pending",
    		source: "(1:0) <script>   import {     psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import {     psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }
    function create_pending_block(ctx) {
    	const block = {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block.name,
    		type: "pending",
    		source: "(1:0) <script>   import {     psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }",
    		ctx
    	});

    	return block;
    }

    function create_fragment$b(ctx) {
    	let nav;
    	let t0;
    	let div1;
    	let div0;
    	let span;
    	let t2;
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	nav = new Nav({ $$inline: true });
    	const if_block_creators = [create_if_block$1, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*loading*/ ctx[3]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			create_component(nav.$$.fragment);
    			t0 = space();
    			div1 = element("div");
    			div0 = element("div");
    			span = element("span");
    			span.textContent = "NEPL CONSOLIDATED PLAN";
    			t2 = space();
    			if_block.c();
    			if_block_anchor = empty();
    			attr_dev(span, "class", "svelte-112fmhv");
    			add_location(span, file$b, 65, 4, 1926);
    			add_location(div0, file$b, 64, 2, 1916);
    			attr_dev(div1, "class", "app-header r-mono flex-c center-first svelte-112fmhv");
    			add_location(div1, file$b, 63, 0, 1862);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(nav, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, span);
    			insert_dev(target, t2, anchor);
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(nav.$$.fragment, local);
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(nav.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(nav, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t2);
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$b($$self, $$props, $$invalidate) {
    	let $plans;
    	let $psVolume;
    	let $revenue;
    	let $expense;
    	let $budget;
    	let $tax;
    	validate_store(plans, "plans");
    	component_subscribe($$self, plans, $$value => $$invalidate(1, $plans = $$value));
    	validate_store(psVolume, "psVolume");
    	component_subscribe($$self, psVolume, $$value => $$invalidate(4, $psVolume = $$value));
    	validate_store(revenue, "revenue");
    	component_subscribe($$self, revenue, $$value => $$invalidate(5, $revenue = $$value));
    	validate_store(expense, "expense");
    	component_subscribe($$self, expense, $$value => $$invalidate(6, $expense = $$value));
    	validate_store(budget, "budget");
    	component_subscribe($$self, budget, $$value => $$invalidate(7, $budget = $$value));
    	validate_store(tax, "tax");
    	component_subscribe($$self, tax, $$value => $$invalidate(8, $tax = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let dataParam;
    	let data;
    	let loading = true;

    	const changeParam = e => {
    		$$invalidate(0, dataParam = e.detail.param);
    		console.log("onclick", dataParam);
    		yearParam.set(dataParam);
    		psVolume.set(getProductionSalesVolumePerYear(dataParam, data));
    		revenue.set(getRevenuePerYear(dataParam, data));
    		expense.set(getExpensePerYear(dataParam, data));
    		budget.set(getBudgetCostPerYear(dataParam, data));
    		tax.set(getTaxPerYear(dataParam, data));
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		psVolume,
    		revenue,
    		expense,
    		budget,
    		tax,
    		plans,
    		yearParam,
    		plansContext,
    		PlanTables,
    		Nav,
    		setContext,
    		onMount,
    		Divider,
    		Sider,
    		TopTable,
    		Card,
    		Net,
    		Loader,
    		getProductionSalesVolumePerYear,
    		getRevenuePerYear,
    		getExpensePerYear,
    		getBudgetCostPerYear,
    		getTaxPerYear,
    		dataParam,
    		data,
    		loading,
    		changeParam,
    		$plans,
    		$psVolume,
    		$revenue,
    		$expense,
    		$budget,
    		$tax
    	});

    	$$self.$inject_state = $$props => {
    		if ("dataParam" in $$props) $$invalidate(0, dataParam = $$props.dataParam);
    		if ("data" in $$props) $$invalidate(2, data = $$props.data);
    		if ("loading" in $$props) $$invalidate(3, loading = $$props.loading);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$plans, data, dataParam*/ 7) {
    			onMount(async () => {
    				setTimeout(() => $$invalidate(3, loading = false), 3000);
    				$$invalidate(2, data = await $plans);

    				// console.log("the data", data)
    				$$invalidate(0, dataParam = plansContext(data)[0]);

    				yearParam.set(dataParam);
    				psVolume.set(getProductionSalesVolumePerYear(dataParam, data));
    				revenue.set(getRevenuePerYear(dataParam, data));
    				expense.set(getExpensePerYear(dataParam, data));
    				budget.set(getBudgetCostPerYear(dataParam, data));
    				tax.set(getTaxPerYear(dataParam, data));
    			});
    		}
    	};

    	return [
    		dataParam,
    		$plans,
    		data,
    		loading,
    		$psVolume,
    		$revenue,
    		$expense,
    		$budget,
    		$tax,
    		changeParam
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$b.name
    		});
    	}
    }

    // import "smelte/src/tailwind.css";

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
