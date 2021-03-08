
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




    async function getProductionSalesVolumePerYear(data = {}) {
      try {
        let response = await fetch(`${url}/plans/year/salesvolume`, {
          method: 'POST',
          headers: {
            'Content-type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        if(!response.ok) throw new Error('Network response was not ok');
        let output = await response.json();
        // console.log(output)
        return output;
      } catch (error) {
        console.error('There has been a problem with your fetch operation:', error);
      }
    }

    async function getRevenuePerYear(data = {}) {
      try {
        let response = await fetch(`${url}/plans/year/revenue`, {
          method: 'POST',
          cache: "no-cache",
          headers: {
            'Content-type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        if(!response.ok) throw new Error('Network response was not ok');
        let output = await response.json();
        // console.log(output)
        return output;
      } catch (error) {
        console.error('There has been a problem with your fetch operation:', error);
      }
    }

    async function getExpensePerYear(data = {}) {
      try {
        let response = await fetch(`${url}/plans/year/expense`, {
          method: 'POST',
          cache: "no-cache",
          headers: {
            'Content-type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        if(!response.ok) throw new Error('Network response was not ok');
        let output = await response.json();
        // console.log(output)
        return output;
      } catch (error) {
        console.error('There has been a problem with your fetch operation:', error);
      }
    }

    async function getBudgetCostPerYear(data = {}) {
      try {
        let response = await fetch(`${url}/plans/year/budget`, {
          method: 'POST',
          cache: "no-cache",
          headers: {
            'Content-type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        if(!response.ok) throw new Error('Network response was not ok');
        let output = await response.json();
        // console.log(output)
        return output;
      } catch (error) {
        console.error('There has been a problem with your fetch operation:', error);
      }
    }

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

    async function getTaxPerYear(data = {}) {
      try {
        let response = await fetch(`${url}/plans/year/tax`, {
          method: 'POST',
          cache: "no-cache",
          headers: {
            'Content-type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        if(!response.ok) throw new Error('Network response was not ok');
        let output = await response.json();
        // console.log(output)
        return output;
      } catch (error) {
        console.error('There has been a problem with your fetch operation:', error);
      }
    }

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
    			attr_dev(td0, "class", "svelte-tzus96");
    			add_location(td0, file, 19, 10, 416);
    			attr_dev(td1, "class", "svelte-tzus96");
    			add_location(td1, file, 20, 10, 456);
    			attr_dev(tr, "class", "svelte-tzus96");
    			add_location(tr, file, 18, 8, 401);
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

    			attr_dev(th0, "class", "svelte-tzus96");
    			add_location(th0, file, 11, 6, 250);
    			attr_dev(th1, "class", "svelte-tzus96");
    			add_location(th1, file, 12, 6, 276);
    			attr_dev(tr, "class", "svelte-tzus96");
    			add_location(tr, file, 10, 4, 239);
    			add_location(thead, file, 9, 2, 227);
    			add_location(tbody, file, 15, 2, 319);
    			attr_dev(table, "class", "styled-table");
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
    	let p;

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			div = element("div");
    			p = element("p");
    			p.textContent = "Make Plan";
    			attr_dev(p, "class", "svelte-eno6vq");
    			add_location(p, file$1, 7, 4, 176);
    			add_location(div, file$1, 5, 2, 124);
    			attr_dev(nav, "class", "app-nav r-mono flex-c newcross center-first svelte-eno6vq");
    			add_location(nav, file$1, 4, 0, 64);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, nav, anchor);
    			append_dev(nav, div);
    			append_dev(div, p);
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
    			attr_dev(p0, "class", "svelte-mkhqqf");
    			add_location(p0, file$3, 7, 2, 145);
    			attr_dev(span0, "class", "svelte-mkhqqf");
    			add_location(span0, file$3, 9, 4, 170);
    			attr_dev(span1, "class", "unit svelte-mkhqqf");
    			add_location(span1, file$3, 10, 4, 195);
    			attr_dev(p1, "class", "svelte-mkhqqf");
    			add_location(p1, file$3, 8, 2, 162);
    			attr_dev(div, "class", "badge flex-c svelte-mkhqqf");
    			add_location(div, file$3, 6, 0, 116);
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
    			attr_dev(section0, "class", "inputs svelte-ujgkii");
    			add_location(section0, file$5, 58, 2, 1510);
    			add_location(div0, file$5, 55, 0, 1459);
    			attr_dev(section1, "class", "badges");
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
    	let section;
    	let measure;
    	let current;
    	measure = new Measures({ $$inline: true });
    	measure.$on("senddataparam", /*senddataparam_handler*/ ctx[0]);

    	const block = {
    		c: function create() {
    			section = element("section");
    			create_component(measure.$$.fragment);
    			attr_dev(section, "class", "sider svelte-dnui1w");
    			add_location(section, file$6, 5, 2, 66);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			mount_component(measure, section, null);
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
    			if (detaching) detach_dev(section);
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
    			add_location(svg, file$7, 138, 2, 3394);
    			attr_dev(div, "id", "test1");
    			attr_dev(div, "class", "svelte-mczlps");
    			add_location(div, file$7, 137, 0, 3375);
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

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function createCommonjsModule(fn) {
      var module = { exports: {} };
    	return fn(module, module.exports), module.exports;
    }

    var chartist = createCommonjsModule(function (module) {
    (function (root, factory) {
      if (module.exports) {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory();
      } else {
        root['Chartist'] = factory();
      }
    }(commonjsGlobal, function () {

    /* Chartist.js 0.11.4
     * Copyright © 2019 Gion Kunz
     * Free to use under either the WTFPL license or the MIT license.
     * https://raw.githubusercontent.com/gionkunz/chartist-js/master/LICENSE-WTFPL
     * https://raw.githubusercontent.com/gionkunz/chartist-js/master/LICENSE-MIT
     */
    /**
     * The core module of Chartist that is mainly providing static functions and higher level functions for chart modules.
     *
     * @module Chartist.Core
     */
    var Chartist = {
      version: '0.11.4'
    };

    (function (globalRoot, Chartist) {

      var window = globalRoot.window;
      var document = globalRoot.document;

      /**
       * This object contains all namespaces used within Chartist.
       *
       * @memberof Chartist.Core
       * @type {{svg: string, xmlns: string, xhtml: string, xlink: string, ct: string}}
       */
      Chartist.namespaces = {
        svg: 'http://www.w3.org/2000/svg',
        xmlns: 'http://www.w3.org/2000/xmlns/',
        xhtml: 'http://www.w3.org/1999/xhtml',
        xlink: 'http://www.w3.org/1999/xlink',
        ct: 'http://gionkunz.github.com/chartist-js/ct'
      };

      /**
       * Helps to simplify functional style code
       *
       * @memberof Chartist.Core
       * @param {*} n This exact value will be returned by the noop function
       * @return {*} The same value that was provided to the n parameter
       */
      Chartist.noop = function (n) {
        return n;
      };

      /**
       * Generates a-z from a number 0 to 26
       *
       * @memberof Chartist.Core
       * @param {Number} n A number from 0 to 26 that will result in a letter a-z
       * @return {String} A character from a-z based on the input number n
       */
      Chartist.alphaNumerate = function (n) {
        // Limit to a-z
        return String.fromCharCode(97 + n % 26);
      };

      /**
       * Simple recursive object extend
       *
       * @memberof Chartist.Core
       * @param {Object} target Target object where the source will be merged into
       * @param {Object...} sources This object (objects) will be merged into target and then target is returned
       * @return {Object} An object that has the same reference as target but is extended and merged with the properties of source
       */
      Chartist.extend = function (target) {
        var i, source, sourceProp;
        target = target || {};

        for (i = 1; i < arguments.length; i++) {
          source = arguments[i];
          for (var prop in source) {
            sourceProp = source[prop];
            if (typeof sourceProp === 'object' && sourceProp !== null && !(sourceProp instanceof Array)) {
              target[prop] = Chartist.extend(target[prop], sourceProp);
            } else {
              target[prop] = sourceProp;
            }
          }
        }

        return target;
      };

      /**
       * Replaces all occurrences of subStr in str with newSubStr and returns a new string.
       *
       * @memberof Chartist.Core
       * @param {String} str
       * @param {String} subStr
       * @param {String} newSubStr
       * @return {String}
       */
      Chartist.replaceAll = function(str, subStr, newSubStr) {
        return str.replace(new RegExp(subStr, 'g'), newSubStr);
      };

      /**
       * Converts a number to a string with a unit. If a string is passed then this will be returned unmodified.
       *
       * @memberof Chartist.Core
       * @param {Number} value
       * @param {String} unit
       * @return {String} Returns the passed number value with unit.
       */
      Chartist.ensureUnit = function(value, unit) {
        if(typeof value === 'number') {
          value = value + unit;
        }

        return value;
      };

      /**
       * Converts a number or string to a quantity object.
       *
       * @memberof Chartist.Core
       * @param {String|Number} input
       * @return {Object} Returns an object containing the value as number and the unit as string.
       */
      Chartist.quantity = function(input) {
        if (typeof input === 'string') {
          var match = (/^(\d+)\s*(.*)$/g).exec(input);
          return {
            value : +match[1],
            unit: match[2] || undefined
          };
        }
        return { value: input };
      };

      /**
       * This is a wrapper around document.querySelector that will return the query if it's already of type Node
       *
       * @memberof Chartist.Core
       * @param {String|Node} query The query to use for selecting a Node or a DOM node that will be returned directly
       * @return {Node}
       */
      Chartist.querySelector = function(query) {
        return query instanceof Node ? query : document.querySelector(query);
      };

      /**
       * Functional style helper to produce array with given length initialized with undefined values
       *
       * @memberof Chartist.Core
       * @param length
       * @return {Array}
       */
      Chartist.times = function(length) {
        return Array.apply(null, new Array(length));
      };

      /**
       * Sum helper to be used in reduce functions
       *
       * @memberof Chartist.Core
       * @param previous
       * @param current
       * @return {*}
       */
      Chartist.sum = function(previous, current) {
        return previous + (current ? current : 0);
      };

      /**
       * Multiply helper to be used in `Array.map` for multiplying each value of an array with a factor.
       *
       * @memberof Chartist.Core
       * @param {Number} factor
       * @returns {Function} Function that can be used in `Array.map` to multiply each value in an array
       */
      Chartist.mapMultiply = function(factor) {
        return function(num) {
          return num * factor;
        };
      };

      /**
       * Add helper to be used in `Array.map` for adding a addend to each value of an array.
       *
       * @memberof Chartist.Core
       * @param {Number} addend
       * @returns {Function} Function that can be used in `Array.map` to add a addend to each value in an array
       */
      Chartist.mapAdd = function(addend) {
        return function(num) {
          return num + addend;
        };
      };

      /**
       * Map for multi dimensional arrays where their nested arrays will be mapped in serial. The output array will have the length of the largest nested array. The callback function is called with variable arguments where each argument is the nested array value (or undefined if there are no more values).
       *
       * @memberof Chartist.Core
       * @param arr
       * @param cb
       * @return {Array}
       */
      Chartist.serialMap = function(arr, cb) {
        var result = [],
            length = Math.max.apply(null, arr.map(function(e) {
              return e.length;
            }));

        Chartist.times(length).forEach(function(e, index) {
          var args = arr.map(function(e) {
            return e[index];
          });

          result[index] = cb.apply(null, args);
        });

        return result;
      };

      /**
       * This helper function can be used to round values with certain precision level after decimal. This is used to prevent rounding errors near float point precision limit.
       *
       * @memberof Chartist.Core
       * @param {Number} value The value that should be rounded with precision
       * @param {Number} [digits] The number of digits after decimal used to do the rounding
       * @returns {number} Rounded value
       */
      Chartist.roundWithPrecision = function(value, digits) {
        var precision = Math.pow(10, digits || Chartist.precision);
        return Math.round(value * precision) / precision;
      };

      /**
       * Precision level used internally in Chartist for rounding. If you require more decimal places you can increase this number.
       *
       * @memberof Chartist.Core
       * @type {number}
       */
      Chartist.precision = 8;

      /**
       * A map with characters to escape for strings to be safely used as attribute values.
       *
       * @memberof Chartist.Core
       * @type {Object}
       */
      Chartist.escapingMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        '\'': '&#039;'
      };

      /**
       * This function serializes arbitrary data to a string. In case of data that can't be easily converted to a string, this function will create a wrapper object and serialize the data using JSON.stringify. The outcoming string will always be escaped using Chartist.escapingMap.
       * If called with null or undefined the function will return immediately with null or undefined.
       *
       * @memberof Chartist.Core
       * @param {Number|String|Object} data
       * @return {String}
       */
      Chartist.serialize = function(data) {
        if(data === null || data === undefined) {
          return data;
        } else if(typeof data === 'number') {
          data = ''+data;
        } else if(typeof data === 'object') {
          data = JSON.stringify({data: data});
        }

        return Object.keys(Chartist.escapingMap).reduce(function(result, key) {
          return Chartist.replaceAll(result, key, Chartist.escapingMap[key]);
        }, data);
      };

      /**
       * This function de-serializes a string previously serialized with Chartist.serialize. The string will always be unescaped using Chartist.escapingMap before it's returned. Based on the input value the return type can be Number, String or Object. JSON.parse is used with try / catch to see if the unescaped string can be parsed into an Object and this Object will be returned on success.
       *
       * @memberof Chartist.Core
       * @param {String} data
       * @return {String|Number|Object}
       */
      Chartist.deserialize = function(data) {
        if(typeof data !== 'string') {
          return data;
        }

        data = Object.keys(Chartist.escapingMap).reduce(function(result, key) {
          return Chartist.replaceAll(result, Chartist.escapingMap[key], key);
        }, data);

        try {
          data = JSON.parse(data);
          data = data.data !== undefined ? data.data : data;
        } catch(e) {}

        return data;
      };

      /**
       * Create or reinitialize the SVG element for the chart
       *
       * @memberof Chartist.Core
       * @param {Node} container The containing DOM Node object that will be used to plant the SVG element
       * @param {String} width Set the width of the SVG element. Default is 100%
       * @param {String} height Set the height of the SVG element. Default is 100%
       * @param {String} className Specify a class to be added to the SVG element
       * @return {Object} The created/reinitialized SVG element
       */
      Chartist.createSvg = function (container, width, height, className) {
        var svg;

        width = width || '100%';
        height = height || '100%';

        // Check if there is a previous SVG element in the container that contains the Chartist XML namespace and remove it
        // Since the DOM API does not support namespaces we need to manually search the returned list http://www.w3.org/TR/selectors-api/
        Array.prototype.slice.call(container.querySelectorAll('svg')).filter(function filterChartistSvgObjects(svg) {
          return svg.getAttributeNS(Chartist.namespaces.xmlns, 'ct');
        }).forEach(function removePreviousElement(svg) {
          container.removeChild(svg);
        });

        // Create svg object with width and height or use 100% as default
        svg = new Chartist.Svg('svg').attr({
          width: width,
          height: height
        }).addClass(className);

        svg._node.style.width = width;
        svg._node.style.height = height;

        // Add the DOM node to our container
        container.appendChild(svg._node);

        return svg;
      };

      /**
       * Ensures that the data object passed as second argument to the charts is present and correctly initialized.
       *
       * @param  {Object} data The data object that is passed as second argument to the charts
       * @return {Object} The normalized data object
       */
      Chartist.normalizeData = function(data, reverse, multi) {
        var labelCount;
        var output = {
          raw: data,
          normalized: {}
        };

        // Check if we should generate some labels based on existing series data
        output.normalized.series = Chartist.getDataArray({
          series: data.series || []
        }, reverse, multi);

        // If all elements of the normalized data array are arrays we're dealing with
        // multi series data and we need to find the largest series if they are un-even
        if (output.normalized.series.every(function(value) {
            return value instanceof Array;
          })) {
          // Getting the series with the the most elements
          labelCount = Math.max.apply(null, output.normalized.series.map(function(series) {
            return series.length;
          }));
        } else {
          // We're dealing with Pie data so we just take the normalized array length
          labelCount = output.normalized.series.length;
        }

        output.normalized.labels = (data.labels || []).slice();
        // Padding the labels to labelCount with empty strings
        Array.prototype.push.apply(
          output.normalized.labels,
          Chartist.times(Math.max(0, labelCount - output.normalized.labels.length)).map(function() {
            return '';
          })
        );

        if(reverse) {
          Chartist.reverseData(output.normalized);
        }

        return output;
      };

      /**
       * This function safely checks if an objects has an owned property.
       *
       * @param {Object} object The object where to check for a property
       * @param {string} property The property name
       * @returns {boolean} Returns true if the object owns the specified property
       */
      Chartist.safeHasProperty = function(object, property) {
        return object !== null &&
          typeof object === 'object' &&
          object.hasOwnProperty(property);
      };

      /**
       * Checks if a value is considered a hole in the data series.
       *
       * @param {*} value
       * @returns {boolean} True if the value is considered a data hole
       */
      Chartist.isDataHoleValue = function(value) {
        return value === null ||
          value === undefined ||
          (typeof value === 'number' && isNaN(value));
      };

      /**
       * Reverses the series, labels and series data arrays.
       *
       * @memberof Chartist.Core
       * @param data
       */
      Chartist.reverseData = function(data) {
        data.labels.reverse();
        data.series.reverse();
        for (var i = 0; i < data.series.length; i++) {
          if(typeof(data.series[i]) === 'object' && data.series[i].data !== undefined) {
            data.series[i].data.reverse();
          } else if(data.series[i] instanceof Array) {
            data.series[i].reverse();
          }
        }
      };

      /**
       * Convert data series into plain array
       *
       * @memberof Chartist.Core
       * @param {Object} data The series object that contains the data to be visualized in the chart
       * @param {Boolean} [reverse] If true the whole data is reversed by the getDataArray call. This will modify the data object passed as first parameter. The labels as well as the series order is reversed. The whole series data arrays are reversed too.
       * @param {Boolean} [multi] Create a multi dimensional array from a series data array where a value object with `x` and `y` values will be created.
       * @return {Array} A plain array that contains the data to be visualized in the chart
       */
      Chartist.getDataArray = function(data, reverse, multi) {
        // Recursively walks through nested arrays and convert string values to numbers and objects with value properties
        // to values. Check the tests in data core -> data normalization for a detailed specification of expected values
        function recursiveConvert(value) {
          if(Chartist.safeHasProperty(value, 'value')) {
            // We are dealing with value object notation so we need to recurse on value property
            return recursiveConvert(value.value);
          } else if(Chartist.safeHasProperty(value, 'data')) {
            // We are dealing with series object notation so we need to recurse on data property
            return recursiveConvert(value.data);
          } else if(value instanceof Array) {
            // Data is of type array so we need to recurse on the series
            return value.map(recursiveConvert);
          } else if(Chartist.isDataHoleValue(value)) {
            // We're dealing with a hole in the data and therefore need to return undefined
            // We're also returning undefined for multi value output
            return undefined;
          } else {
            // We need to prepare multi value output (x and y data)
            if(multi) {
              var multiValue = {};

              // Single series value arrays are assumed to specify the Y-Axis value
              // For example: [1, 2] => [{x: undefined, y: 1}, {x: undefined, y: 2}]
              // If multi is a string then it's assumed that it specified which dimension should be filled as default
              if(typeof multi === 'string') {
                multiValue[multi] = Chartist.getNumberOrUndefined(value);
              } else {
                multiValue.y = Chartist.getNumberOrUndefined(value);
              }

              multiValue.x = value.hasOwnProperty('x') ? Chartist.getNumberOrUndefined(value.x) : multiValue.x;
              multiValue.y = value.hasOwnProperty('y') ? Chartist.getNumberOrUndefined(value.y) : multiValue.y;

              return multiValue;

            } else {
              // We can return simple data
              return Chartist.getNumberOrUndefined(value);
            }
          }
        }

        return data.series.map(recursiveConvert);
      };

      /**
       * Converts a number into a padding object.
       *
       * @memberof Chartist.Core
       * @param {Object|Number} padding
       * @param {Number} [fallback] This value is used to fill missing values if a incomplete padding object was passed
       * @returns {Object} Returns a padding object containing top, right, bottom, left properties filled with the padding number passed in as argument. If the argument is something else than a number (presumably already a correct padding object) then this argument is directly returned.
       */
      Chartist.normalizePadding = function(padding, fallback) {
        fallback = fallback || 0;

        return typeof padding === 'number' ? {
          top: padding,
          right: padding,
          bottom: padding,
          left: padding
        } : {
          top: typeof padding.top === 'number' ? padding.top : fallback,
          right: typeof padding.right === 'number' ? padding.right : fallback,
          bottom: typeof padding.bottom === 'number' ? padding.bottom : fallback,
          left: typeof padding.left === 'number' ? padding.left : fallback
        };
      };

      Chartist.getMetaData = function(series, index) {
        var value = series.data ? series.data[index] : series[index];
        return value ? value.meta : undefined;
      };

      /**
       * Calculate the order of magnitude for the chart scale
       *
       * @memberof Chartist.Core
       * @param {Number} value The value Range of the chart
       * @return {Number} The order of magnitude
       */
      Chartist.orderOfMagnitude = function (value) {
        return Math.floor(Math.log(Math.abs(value)) / Math.LN10);
      };

      /**
       * Project a data length into screen coordinates (pixels)
       *
       * @memberof Chartist.Core
       * @param {Object} axisLength The svg element for the chart
       * @param {Number} length Single data value from a series array
       * @param {Object} bounds All the values to set the bounds of the chart
       * @return {Number} The projected data length in pixels
       */
      Chartist.projectLength = function (axisLength, length, bounds) {
        return length / bounds.range * axisLength;
      };

      /**
       * Get the height of the area in the chart for the data series
       *
       * @memberof Chartist.Core
       * @param {Object} svg The svg element for the chart
       * @param {Object} options The Object that contains all the optional values for the chart
       * @return {Number} The height of the area in the chart for the data series
       */
      Chartist.getAvailableHeight = function (svg, options) {
        return Math.max((Chartist.quantity(options.height).value || svg.height()) - (options.chartPadding.top +  options.chartPadding.bottom) - options.axisX.offset, 0);
      };

      /**
       * Get highest and lowest value of data array. This Array contains the data that will be visualized in the chart.
       *
       * @memberof Chartist.Core
       * @param {Array} data The array that contains the data to be visualized in the chart
       * @param {Object} options The Object that contains the chart options
       * @param {String} dimension Axis dimension 'x' or 'y' used to access the correct value and high / low configuration
       * @return {Object} An object that contains the highest and lowest value that will be visualized on the chart.
       */
      Chartist.getHighLow = function (data, options, dimension) {
        // TODO: Remove workaround for deprecated global high / low config. Axis high / low configuration is preferred
        options = Chartist.extend({}, options, dimension ? options['axis' + dimension.toUpperCase()] : {});

        var highLow = {
            high: options.high === undefined ? -Number.MAX_VALUE : +options.high,
            low: options.low === undefined ? Number.MAX_VALUE : +options.low
          };
        var findHigh = options.high === undefined;
        var findLow = options.low === undefined;

        // Function to recursively walk through arrays and find highest and lowest number
        function recursiveHighLow(data) {
          if(data === undefined) {
            return undefined;
          } else if(data instanceof Array) {
            for (var i = 0; i < data.length; i++) {
              recursiveHighLow(data[i]);
            }
          } else {
            var value = dimension ? +data[dimension] : +data;

            if (findHigh && value > highLow.high) {
              highLow.high = value;
            }

            if (findLow && value < highLow.low) {
              highLow.low = value;
            }
          }
        }

        // Start to find highest and lowest number recursively
        if(findHigh || findLow) {
          recursiveHighLow(data);
        }

        // Overrides of high / low based on reference value, it will make sure that the invisible reference value is
        // used to generate the chart. This is useful when the chart always needs to contain the position of the
        // invisible reference value in the view i.e. for bipolar scales.
        if (options.referenceValue || options.referenceValue === 0) {
          highLow.high = Math.max(options.referenceValue, highLow.high);
          highLow.low = Math.min(options.referenceValue, highLow.low);
        }

        // If high and low are the same because of misconfiguration or flat data (only the same value) we need
        // to set the high or low to 0 depending on the polarity
        if (highLow.high <= highLow.low) {
          // If both values are 0 we set high to 1
          if (highLow.low === 0) {
            highLow.high = 1;
          } else if (highLow.low < 0) {
            // If we have the same negative value for the bounds we set bounds.high to 0
            highLow.high = 0;
          } else if (highLow.high > 0) {
            // If we have the same positive value for the bounds we set bounds.low to 0
            highLow.low = 0;
          } else {
            // If data array was empty, values are Number.MAX_VALUE and -Number.MAX_VALUE. Set bounds to prevent errors
            highLow.high = 1;
            highLow.low = 0;
          }
        }

        return highLow;
      };

      /**
       * Checks if a value can be safely coerced to a number. This includes all values except null which result in finite numbers when coerced. This excludes NaN, since it's not finite.
       *
       * @memberof Chartist.Core
       * @param value
       * @returns {Boolean}
       */
      Chartist.isNumeric = function(value) {
        return value === null ? false : isFinite(value);
      };

      /**
       * Returns true on all falsey values except the numeric value 0.
       *
       * @memberof Chartist.Core
       * @param value
       * @returns {boolean}
       */
      Chartist.isFalseyButZero = function(value) {
        return !value && value !== 0;
      };

      /**
       * Returns a number if the passed parameter is a valid number or the function will return undefined. On all other values than a valid number, this function will return undefined.
       *
       * @memberof Chartist.Core
       * @param value
       * @returns {*}
       */
      Chartist.getNumberOrUndefined = function(value) {
        return Chartist.isNumeric(value) ? +value : undefined;
      };

      /**
       * Checks if provided value object is multi value (contains x or y properties)
       *
       * @memberof Chartist.Core
       * @param value
       */
      Chartist.isMultiValue = function(value) {
        return typeof value === 'object' && ('x' in value || 'y' in value);
      };

      /**
       * Gets a value from a dimension `value.x` or `value.y` while returning value directly if it's a valid numeric value. If the value is not numeric and it's falsey this function will return `defaultValue`.
       *
       * @memberof Chartist.Core
       * @param value
       * @param dimension
       * @param defaultValue
       * @returns {*}
       */
      Chartist.getMultiValue = function(value, dimension) {
        if(Chartist.isMultiValue(value)) {
          return Chartist.getNumberOrUndefined(value[dimension || 'y']);
        } else {
          return Chartist.getNumberOrUndefined(value);
        }
      };

      /**
       * Pollard Rho Algorithm to find smallest factor of an integer value. There are more efficient algorithms for factorization, but this one is quite efficient and not so complex.
       *
       * @memberof Chartist.Core
       * @param {Number} num An integer number where the smallest factor should be searched for
       * @returns {Number} The smallest integer factor of the parameter num.
       */
      Chartist.rho = function(num) {
        if(num === 1) {
          return num;
        }

        function gcd(p, q) {
          if (p % q === 0) {
            return q;
          } else {
            return gcd(q, p % q);
          }
        }

        function f(x) {
          return x * x + 1;
        }

        var x1 = 2, x2 = 2, divisor;
        if (num % 2 === 0) {
          return 2;
        }

        do {
          x1 = f(x1) % num;
          x2 = f(f(x2)) % num;
          divisor = gcd(Math.abs(x1 - x2), num);
        } while (divisor === 1);

        return divisor;
      };

      /**
       * Calculate and retrieve all the bounds for the chart and return them in one array
       *
       * @memberof Chartist.Core
       * @param {Number} axisLength The length of the Axis used for
       * @param {Object} highLow An object containing a high and low property indicating the value range of the chart.
       * @param {Number} scaleMinSpace The minimum projected length a step should result in
       * @param {Boolean} onlyInteger
       * @return {Object} All the values to set the bounds of the chart
       */
      Chartist.getBounds = function (axisLength, highLow, scaleMinSpace, onlyInteger) {
        var i,
          optimizationCounter = 0,
          newMin,
          newMax,
          bounds = {
            high: highLow.high,
            low: highLow.low
          };

        bounds.valueRange = bounds.high - bounds.low;
        bounds.oom = Chartist.orderOfMagnitude(bounds.valueRange);
        bounds.step = Math.pow(10, bounds.oom);
        bounds.min = Math.floor(bounds.low / bounds.step) * bounds.step;
        bounds.max = Math.ceil(bounds.high / bounds.step) * bounds.step;
        bounds.range = bounds.max - bounds.min;
        bounds.numberOfSteps = Math.round(bounds.range / bounds.step);

        // Optimize scale step by checking if subdivision is possible based on horizontalGridMinSpace
        // If we are already below the scaleMinSpace value we will scale up
        var length = Chartist.projectLength(axisLength, bounds.step, bounds);
        var scaleUp = length < scaleMinSpace;
        var smallestFactor = onlyInteger ? Chartist.rho(bounds.range) : 0;

        // First check if we should only use integer steps and if step 1 is still larger than scaleMinSpace so we can use 1
        if(onlyInteger && Chartist.projectLength(axisLength, 1, bounds) >= scaleMinSpace) {
          bounds.step = 1;
        } else if(onlyInteger && smallestFactor < bounds.step && Chartist.projectLength(axisLength, smallestFactor, bounds) >= scaleMinSpace) {
          // If step 1 was too small, we can try the smallest factor of range
          // If the smallest factor is smaller than the current bounds.step and the projected length of smallest factor
          // is larger than the scaleMinSpace we should go for it.
          bounds.step = smallestFactor;
        } else {
          // Trying to divide or multiply by 2 and find the best step value
          while (true) {
            if (scaleUp && Chartist.projectLength(axisLength, bounds.step, bounds) <= scaleMinSpace) {
              bounds.step *= 2;
            } else if (!scaleUp && Chartist.projectLength(axisLength, bounds.step / 2, bounds) >= scaleMinSpace) {
              bounds.step /= 2;
              if(onlyInteger && bounds.step % 1 !== 0) {
                bounds.step *= 2;
                break;
              }
            } else {
              break;
            }

            if(optimizationCounter++ > 1000) {
              throw new Error('Exceeded maximum number of iterations while optimizing scale step!');
            }
          }
        }

        var EPSILON = 2.221E-16;
        bounds.step = Math.max(bounds.step, EPSILON);
        function safeIncrement(value, increment) {
          // If increment is too small use *= (1+EPSILON) as a simple nextafter
          if (value === (value += increment)) {
          	value *= (1 + (increment > 0 ? EPSILON : -EPSILON));
          }
          return value;
        }

        // Narrow min and max based on new step
        newMin = bounds.min;
        newMax = bounds.max;
        while (newMin + bounds.step <= bounds.low) {
        	newMin = safeIncrement(newMin, bounds.step);
        }
        while (newMax - bounds.step >= bounds.high) {
        	newMax = safeIncrement(newMax, -bounds.step);
        }
        bounds.min = newMin;
        bounds.max = newMax;
        bounds.range = bounds.max - bounds.min;

        var values = [];
        for (i = bounds.min; i <= bounds.max; i = safeIncrement(i, bounds.step)) {
          var value = Chartist.roundWithPrecision(i);
          if (value !== values[values.length - 1]) {
            values.push(value);
          }
        }
        bounds.values = values;
        return bounds;
      };

      /**
       * Calculate cartesian coordinates of polar coordinates
       *
       * @memberof Chartist.Core
       * @param {Number} centerX X-axis coordinates of center point of circle segment
       * @param {Number} centerY X-axis coordinates of center point of circle segment
       * @param {Number} radius Radius of circle segment
       * @param {Number} angleInDegrees Angle of circle segment in degrees
       * @return {{x:Number, y:Number}} Coordinates of point on circumference
       */
      Chartist.polarToCartesian = function (centerX, centerY, radius, angleInDegrees) {
        var angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;

        return {
          x: centerX + (radius * Math.cos(angleInRadians)),
          y: centerY + (radius * Math.sin(angleInRadians))
        };
      };

      /**
       * Initialize chart drawing rectangle (area where chart is drawn) x1,y1 = bottom left / x2,y2 = top right
       *
       * @memberof Chartist.Core
       * @param {Object} svg The svg element for the chart
       * @param {Object} options The Object that contains all the optional values for the chart
       * @param {Number} [fallbackPadding] The fallback padding if partial padding objects are used
       * @return {Object} The chart rectangles coordinates inside the svg element plus the rectangles measurements
       */
      Chartist.createChartRect = function (svg, options, fallbackPadding) {
        var hasAxis = !!(options.axisX || options.axisY);
        var yAxisOffset = hasAxis ? options.axisY.offset : 0;
        var xAxisOffset = hasAxis ? options.axisX.offset : 0;
        // If width or height results in invalid value (including 0) we fallback to the unitless settings or even 0
        var width = svg.width() || Chartist.quantity(options.width).value || 0;
        var height = svg.height() || Chartist.quantity(options.height).value || 0;
        var normalizedPadding = Chartist.normalizePadding(options.chartPadding, fallbackPadding);

        // If settings were to small to cope with offset (legacy) and padding, we'll adjust
        width = Math.max(width, yAxisOffset + normalizedPadding.left + normalizedPadding.right);
        height = Math.max(height, xAxisOffset + normalizedPadding.top + normalizedPadding.bottom);

        var chartRect = {
          padding: normalizedPadding,
          width: function () {
            return this.x2 - this.x1;
          },
          height: function () {
            return this.y1 - this.y2;
          }
        };

        if(hasAxis) {
          if (options.axisX.position === 'start') {
            chartRect.y2 = normalizedPadding.top + xAxisOffset;
            chartRect.y1 = Math.max(height - normalizedPadding.bottom, chartRect.y2 + 1);
          } else {
            chartRect.y2 = normalizedPadding.top;
            chartRect.y1 = Math.max(height - normalizedPadding.bottom - xAxisOffset, chartRect.y2 + 1);
          }

          if (options.axisY.position === 'start') {
            chartRect.x1 = normalizedPadding.left + yAxisOffset;
            chartRect.x2 = Math.max(width - normalizedPadding.right, chartRect.x1 + 1);
          } else {
            chartRect.x1 = normalizedPadding.left;
            chartRect.x2 = Math.max(width - normalizedPadding.right - yAxisOffset, chartRect.x1 + 1);
          }
        } else {
          chartRect.x1 = normalizedPadding.left;
          chartRect.x2 = Math.max(width - normalizedPadding.right, chartRect.x1 + 1);
          chartRect.y2 = normalizedPadding.top;
          chartRect.y1 = Math.max(height - normalizedPadding.bottom, chartRect.y2 + 1);
        }

        return chartRect;
      };

      /**
       * Creates a grid line based on a projected value.
       *
       * @memberof Chartist.Core
       * @param position
       * @param index
       * @param axis
       * @param offset
       * @param length
       * @param group
       * @param classes
       * @param eventEmitter
       */
      Chartist.createGrid = function(position, index, axis, offset, length, group, classes, eventEmitter) {
        var positionalData = {};
        positionalData[axis.units.pos + '1'] = position;
        positionalData[axis.units.pos + '2'] = position;
        positionalData[axis.counterUnits.pos + '1'] = offset;
        positionalData[axis.counterUnits.pos + '2'] = offset + length;

        var gridElement = group.elem('line', positionalData, classes.join(' '));

        // Event for grid draw
        eventEmitter.emit('draw',
          Chartist.extend({
            type: 'grid',
            axis: axis,
            index: index,
            group: group,
            element: gridElement
          }, positionalData)
        );
      };

      /**
       * Creates a grid background rect and emits the draw event.
       *
       * @memberof Chartist.Core
       * @param gridGroup
       * @param chartRect
       * @param className
       * @param eventEmitter
       */
      Chartist.createGridBackground = function (gridGroup, chartRect, className, eventEmitter) {
        var gridBackground = gridGroup.elem('rect', {
            x: chartRect.x1,
            y: chartRect.y2,
            width: chartRect.width(),
            height: chartRect.height(),
          }, className, true);

          // Event for grid background draw
          eventEmitter.emit('draw', {
            type: 'gridBackground',
            group: gridGroup,
            element: gridBackground
          });
      };

      /**
       * Creates a label based on a projected value and an axis.
       *
       * @memberof Chartist.Core
       * @param position
       * @param length
       * @param index
       * @param labels
       * @param axis
       * @param axisOffset
       * @param labelOffset
       * @param group
       * @param classes
       * @param useForeignObject
       * @param eventEmitter
       */
      Chartist.createLabel = function(position, length, index, labels, axis, axisOffset, labelOffset, group, classes, useForeignObject, eventEmitter) {
        var labelElement;
        var positionalData = {};

        positionalData[axis.units.pos] = position + labelOffset[axis.units.pos];
        positionalData[axis.counterUnits.pos] = labelOffset[axis.counterUnits.pos];
        positionalData[axis.units.len] = length;
        positionalData[axis.counterUnits.len] = Math.max(0, axisOffset - 10);

        if(useForeignObject) {
          // We need to set width and height explicitly to px as span will not expand with width and height being
          // 100% in all browsers
          var content = document.createElement('span');
          content.className = classes.join(' ');
          content.setAttribute('xmlns', Chartist.namespaces.xhtml);
          content.innerText = labels[index];
          content.style[axis.units.len] = Math.round(positionalData[axis.units.len]) + 'px';
          content.style[axis.counterUnits.len] = Math.round(positionalData[axis.counterUnits.len]) + 'px';

          labelElement = group.foreignObject(content, Chartist.extend({
            style: 'overflow: visible;'
          }, positionalData));
        } else {
          labelElement = group.elem('text', positionalData, classes.join(' ')).text(labels[index]);
        }

        eventEmitter.emit('draw', Chartist.extend({
          type: 'label',
          axis: axis,
          index: index,
          group: group,
          element: labelElement,
          text: labels[index]
        }, positionalData));
      };

      /**
       * Helper to read series specific options from options object. It automatically falls back to the global option if
       * there is no option in the series options.
       *
       * @param {Object} series Series object
       * @param {Object} options Chartist options object
       * @param {string} key The options key that should be used to obtain the options
       * @returns {*}
       */
      Chartist.getSeriesOption = function(series, options, key) {
        if(series.name && options.series && options.series[series.name]) {
          var seriesOptions = options.series[series.name];
          return seriesOptions.hasOwnProperty(key) ? seriesOptions[key] : options[key];
        } else {
          return options[key];
        }
      };

      /**
       * Provides options handling functionality with callback for options changes triggered by responsive options and media query matches
       *
       * @memberof Chartist.Core
       * @param {Object} options Options set by user
       * @param {Array} responsiveOptions Optional functions to add responsive behavior to chart
       * @param {Object} eventEmitter The event emitter that will be used to emit the options changed events
       * @return {Object} The consolidated options object from the defaults, base and matching responsive options
       */
      Chartist.optionsProvider = function (options, responsiveOptions, eventEmitter) {
        var baseOptions = Chartist.extend({}, options),
          currentOptions,
          mediaQueryListeners = [],
          i;

        function updateCurrentOptions(mediaEvent) {
          var previousOptions = currentOptions;
          currentOptions = Chartist.extend({}, baseOptions);

          if (responsiveOptions) {
            for (i = 0; i < responsiveOptions.length; i++) {
              var mql = window.matchMedia(responsiveOptions[i][0]);
              if (mql.matches) {
                currentOptions = Chartist.extend(currentOptions, responsiveOptions[i][1]);
              }
            }
          }

          if(eventEmitter && mediaEvent) {
            eventEmitter.emit('optionsChanged', {
              previousOptions: previousOptions,
              currentOptions: currentOptions
            });
          }
        }

        function removeMediaQueryListeners() {
          mediaQueryListeners.forEach(function(mql) {
            mql.removeListener(updateCurrentOptions);
          });
        }

        if (!window.matchMedia) {
          throw 'window.matchMedia not found! Make sure you\'re using a polyfill.';
        } else if (responsiveOptions) {

          for (i = 0; i < responsiveOptions.length; i++) {
            var mql = window.matchMedia(responsiveOptions[i][0]);
            mql.addListener(updateCurrentOptions);
            mediaQueryListeners.push(mql);
          }
        }
        // Execute initially without an event argument so we get the correct options
        updateCurrentOptions();

        return {
          removeMediaQueryListeners: removeMediaQueryListeners,
          getCurrentOptions: function getCurrentOptions() {
            return Chartist.extend({}, currentOptions);
          }
        };
      };


      /**
       * Splits a list of coordinates and associated values into segments. Each returned segment contains a pathCoordinates
       * valueData property describing the segment.
       *
       * With the default options, segments consist of contiguous sets of points that do not have an undefined value. Any
       * points with undefined values are discarded.
       *
       * **Options**
       * The following options are used to determine how segments are formed
       * ```javascript
       * var options = {
       *   // If fillHoles is true, undefined values are simply discarded without creating a new segment. Assuming other options are default, this returns single segment.
       *   fillHoles: false,
       *   // If increasingX is true, the coordinates in all segments have strictly increasing x-values.
       *   increasingX: false
       * };
       * ```
       *
       * @memberof Chartist.Core
       * @param {Array} pathCoordinates List of point coordinates to be split in the form [x1, y1, x2, y2 ... xn, yn]
       * @param {Array} values List of associated point values in the form [v1, v2 .. vn]
       * @param {Object} options Options set by user
       * @return {Array} List of segments, each containing a pathCoordinates and valueData property.
       */
      Chartist.splitIntoSegments = function(pathCoordinates, valueData, options) {
        var defaultOptions = {
          increasingX: false,
          fillHoles: false
        };

        options = Chartist.extend({}, defaultOptions, options);

        var segments = [];
        var hole = true;

        for(var i = 0; i < pathCoordinates.length; i += 2) {
          // If this value is a "hole" we set the hole flag
          if(Chartist.getMultiValue(valueData[i / 2].value) === undefined) {
          // if(valueData[i / 2].value === undefined) {
            if(!options.fillHoles) {
              hole = true;
            }
          } else {
            if(options.increasingX && i >= 2 && pathCoordinates[i] <= pathCoordinates[i-2]) {
              // X is not increasing, so we need to make sure we start a new segment
              hole = true;
            }


            // If it's a valid value we need to check if we're coming out of a hole and create a new empty segment
            if(hole) {
              segments.push({
                pathCoordinates: [],
                valueData: []
              });
              // As we have a valid value now, we are not in a "hole" anymore
              hole = false;
            }

            // Add to the segment pathCoordinates and valueData
            segments[segments.length - 1].pathCoordinates.push(pathCoordinates[i], pathCoordinates[i + 1]);
            segments[segments.length - 1].valueData.push(valueData[i / 2]);
          }
        }

        return segments;
      };
    }(this || commonjsGlobal, Chartist));
    /* global Chartist */
    (function(globalRoot, Chartist) {

      Chartist.Interpolation = {};

      /**
       * This interpolation function does not smooth the path and the result is only containing lines and no curves.
       *
       * @example
       * var chart = new Chartist.Line('.ct-chart', {
       *   labels: [1, 2, 3, 4, 5],
       *   series: [[1, 2, 8, 1, 7]]
       * }, {
       *   lineSmooth: Chartist.Interpolation.none({
       *     fillHoles: false
       *   })
       * });
       *
       *
       * @memberof Chartist.Interpolation
       * @return {Function}
       */
      Chartist.Interpolation.none = function(options) {
        var defaultOptions = {
          fillHoles: false
        };
        options = Chartist.extend({}, defaultOptions, options);
        return function none(pathCoordinates, valueData) {
          var path = new Chartist.Svg.Path();
          var hole = true;

          for(var i = 0; i < pathCoordinates.length; i += 2) {
            var currX = pathCoordinates[i];
            var currY = pathCoordinates[i + 1];
            var currData = valueData[i / 2];

            if(Chartist.getMultiValue(currData.value) !== undefined) {

              if(hole) {
                path.move(currX, currY, false, currData);
              } else {
                path.line(currX, currY, false, currData);
              }

              hole = false;
            } else if(!options.fillHoles) {
              hole = true;
            }
          }

          return path;
        };
      };

      /**
       * Simple smoothing creates horizontal handles that are positioned with a fraction of the length between two data points. You can use the divisor option to specify the amount of smoothing.
       *
       * Simple smoothing can be used instead of `Chartist.Smoothing.cardinal` if you'd like to get rid of the artifacts it produces sometimes. Simple smoothing produces less flowing lines but is accurate by hitting the points and it also doesn't swing below or above the given data point.
       *
       * All smoothing functions within Chartist are factory functions that accept an options parameter. The simple interpolation function accepts one configuration parameter `divisor`, between 1 and ∞, which controls the smoothing characteristics.
       *
       * @example
       * var chart = new Chartist.Line('.ct-chart', {
       *   labels: [1, 2, 3, 4, 5],
       *   series: [[1, 2, 8, 1, 7]]
       * }, {
       *   lineSmooth: Chartist.Interpolation.simple({
       *     divisor: 2,
       *     fillHoles: false
       *   })
       * });
       *
       *
       * @memberof Chartist.Interpolation
       * @param {Object} options The options of the simple interpolation factory function.
       * @return {Function}
       */
      Chartist.Interpolation.simple = function(options) {
        var defaultOptions = {
          divisor: 2,
          fillHoles: false
        };
        options = Chartist.extend({}, defaultOptions, options);

        var d = 1 / Math.max(1, options.divisor);

        return function simple(pathCoordinates, valueData) {
          var path = new Chartist.Svg.Path();
          var prevX, prevY, prevData;

          for(var i = 0; i < pathCoordinates.length; i += 2) {
            var currX = pathCoordinates[i];
            var currY = pathCoordinates[i + 1];
            var length = (currX - prevX) * d;
            var currData = valueData[i / 2];

            if(currData.value !== undefined) {

              if(prevData === undefined) {
                path.move(currX, currY, false, currData);
              } else {
                path.curve(
                  prevX + length,
                  prevY,
                  currX - length,
                  currY,
                  currX,
                  currY,
                  false,
                  currData
                );
              }

              prevX = currX;
              prevY = currY;
              prevData = currData;
            } else if(!options.fillHoles) {
              prevX = currX = prevData = undefined;
            }
          }

          return path;
        };
      };

      /**
       * Cardinal / Catmull-Rome spline interpolation is the default smoothing function in Chartist. It produces nice results where the splines will always meet the points. It produces some artifacts though when data values are increased or decreased rapidly. The line may not follow a very accurate path and if the line should be accurate this smoothing function does not produce the best results.
       *
       * Cardinal splines can only be created if there are more than two data points. If this is not the case this smoothing will fallback to `Chartist.Smoothing.none`.
       *
       * All smoothing functions within Chartist are factory functions that accept an options parameter. The cardinal interpolation function accepts one configuration parameter `tension`, between 0 and 1, which controls the smoothing intensity.
       *
       * @example
       * var chart = new Chartist.Line('.ct-chart', {
       *   labels: [1, 2, 3, 4, 5],
       *   series: [[1, 2, 8, 1, 7]]
       * }, {
       *   lineSmooth: Chartist.Interpolation.cardinal({
       *     tension: 1,
       *     fillHoles: false
       *   })
       * });
       *
       * @memberof Chartist.Interpolation
       * @param {Object} options The options of the cardinal factory function.
       * @return {Function}
       */
      Chartist.Interpolation.cardinal = function(options) {
        var defaultOptions = {
          tension: 1,
          fillHoles: false
        };

        options = Chartist.extend({}, defaultOptions, options);

        var t = Math.min(1, Math.max(0, options.tension)),
          c = 1 - t;

        return function cardinal(pathCoordinates, valueData) {
          // First we try to split the coordinates into segments
          // This is necessary to treat "holes" in line charts
          var segments = Chartist.splitIntoSegments(pathCoordinates, valueData, {
            fillHoles: options.fillHoles
          });

          if(!segments.length) {
            // If there were no segments return 'Chartist.Interpolation.none'
            return Chartist.Interpolation.none()([]);
          } else if(segments.length > 1) {
            // If the split resulted in more that one segment we need to interpolate each segment individually and join them
            // afterwards together into a single path.
              var paths = [];
            // For each segment we will recurse the cardinal function
            segments.forEach(function(segment) {
              paths.push(cardinal(segment.pathCoordinates, segment.valueData));
            });
            // Join the segment path data into a single path and return
            return Chartist.Svg.Path.join(paths);
          } else {
            // If there was only one segment we can proceed regularly by using pathCoordinates and valueData from the first
            // segment
            pathCoordinates = segments[0].pathCoordinates;
            valueData = segments[0].valueData;

            // If less than two points we need to fallback to no smoothing
            if(pathCoordinates.length <= 4) {
              return Chartist.Interpolation.none()(pathCoordinates, valueData);
            }

            var path = new Chartist.Svg.Path().move(pathCoordinates[0], pathCoordinates[1], false, valueData[0]),
              z;

            for (var i = 0, iLen = pathCoordinates.length; iLen - 2 * !z > i; i += 2) {
              var p = [
                {x: +pathCoordinates[i - 2], y: +pathCoordinates[i - 1]},
                {x: +pathCoordinates[i], y: +pathCoordinates[i + 1]},
                {x: +pathCoordinates[i + 2], y: +pathCoordinates[i + 3]},
                {x: +pathCoordinates[i + 4], y: +pathCoordinates[i + 5]}
              ];
              if (z) {
                if (!i) {
                  p[0] = {x: +pathCoordinates[iLen - 2], y: +pathCoordinates[iLen - 1]};
                } else if (iLen - 4 === i) {
                  p[3] = {x: +pathCoordinates[0], y: +pathCoordinates[1]};
                } else if (iLen - 2 === i) {
                  p[2] = {x: +pathCoordinates[0], y: +pathCoordinates[1]};
                  p[3] = {x: +pathCoordinates[2], y: +pathCoordinates[3]};
                }
              } else {
                if (iLen - 4 === i) {
                  p[3] = p[2];
                } else if (!i) {
                  p[0] = {x: +pathCoordinates[i], y: +pathCoordinates[i + 1]};
                }
              }

              path.curve(
                (t * (-p[0].x + 6 * p[1].x + p[2].x) / 6) + (c * p[2].x),
                (t * (-p[0].y + 6 * p[1].y + p[2].y) / 6) + (c * p[2].y),
                (t * (p[1].x + 6 * p[2].x - p[3].x) / 6) + (c * p[2].x),
                (t * (p[1].y + 6 * p[2].y - p[3].y) / 6) + (c * p[2].y),
                p[2].x,
                p[2].y,
                false,
                valueData[(i + 2) / 2]
              );
            }

            return path;
          }
        };
      };

      /**
       * Monotone Cubic spline interpolation produces a smooth curve which preserves monotonicity. Unlike cardinal splines, the curve will not extend beyond the range of y-values of the original data points.
       *
       * Monotone Cubic splines can only be created if there are more than two data points. If this is not the case this smoothing will fallback to `Chartist.Smoothing.none`.
       *
       * The x-values of subsequent points must be increasing to fit a Monotone Cubic spline. If this condition is not met for a pair of adjacent points, then there will be a break in the curve between those data points.
       *
       * All smoothing functions within Chartist are factory functions that accept an options parameter.
       *
       * @example
       * var chart = new Chartist.Line('.ct-chart', {
       *   labels: [1, 2, 3, 4, 5],
       *   series: [[1, 2, 8, 1, 7]]
       * }, {
       *   lineSmooth: Chartist.Interpolation.monotoneCubic({
       *     fillHoles: false
       *   })
       * });
       *
       * @memberof Chartist.Interpolation
       * @param {Object} options The options of the monotoneCubic factory function.
       * @return {Function}
       */
      Chartist.Interpolation.monotoneCubic = function(options) {
        var defaultOptions = {
          fillHoles: false
        };

        options = Chartist.extend({}, defaultOptions, options);

        return function monotoneCubic(pathCoordinates, valueData) {
          // First we try to split the coordinates into segments
          // This is necessary to treat "holes" in line charts
          var segments = Chartist.splitIntoSegments(pathCoordinates, valueData, {
            fillHoles: options.fillHoles,
            increasingX: true
          });

          if(!segments.length) {
            // If there were no segments return 'Chartist.Interpolation.none'
            return Chartist.Interpolation.none()([]);
          } else if(segments.length > 1) {
            // If the split resulted in more that one segment we need to interpolate each segment individually and join them
            // afterwards together into a single path.
              var paths = [];
            // For each segment we will recurse the monotoneCubic fn function
            segments.forEach(function(segment) {
              paths.push(monotoneCubic(segment.pathCoordinates, segment.valueData));
            });
            // Join the segment path data into a single path and return
            return Chartist.Svg.Path.join(paths);
          } else {
            // If there was only one segment we can proceed regularly by using pathCoordinates and valueData from the first
            // segment
            pathCoordinates = segments[0].pathCoordinates;
            valueData = segments[0].valueData;

            // If less than three points we need to fallback to no smoothing
            if(pathCoordinates.length <= 4) {
              return Chartist.Interpolation.none()(pathCoordinates, valueData);
            }

            var xs = [],
              ys = [],
              i,
              n = pathCoordinates.length / 2,
              ms = [],
              ds = [], dys = [], dxs = [],
              path;

            // Populate x and y coordinates into separate arrays, for readability

            for(i = 0; i < n; i++) {
              xs[i] = pathCoordinates[i * 2];
              ys[i] = pathCoordinates[i * 2 + 1];
            }

            // Calculate deltas and derivative

            for(i = 0; i < n - 1; i++) {
              dys[i] = ys[i + 1] - ys[i];
              dxs[i] = xs[i + 1] - xs[i];
              ds[i] = dys[i] / dxs[i];
            }

            // Determine desired slope (m) at each point using Fritsch-Carlson method
            // See: http://math.stackexchange.com/questions/45218/implementation-of-monotone-cubic-interpolation

            ms[0] = ds[0];
            ms[n - 1] = ds[n - 2];

            for(i = 1; i < n - 1; i++) {
              if(ds[i] === 0 || ds[i - 1] === 0 || (ds[i - 1] > 0) !== (ds[i] > 0)) {
                ms[i] = 0;
              } else {
                ms[i] = 3 * (dxs[i - 1] + dxs[i]) / (
                  (2 * dxs[i] + dxs[i - 1]) / ds[i - 1] +
                  (dxs[i] + 2 * dxs[i - 1]) / ds[i]);

                if(!isFinite(ms[i])) {
                  ms[i] = 0;
                }
              }
            }

            // Now build a path from the slopes

            path = new Chartist.Svg.Path().move(xs[0], ys[0], false, valueData[0]);

            for(i = 0; i < n - 1; i++) {
              path.curve(
                // First control point
                xs[i] + dxs[i] / 3,
                ys[i] + ms[i] * dxs[i] / 3,
                // Second control point
                xs[i + 1] - dxs[i] / 3,
                ys[i + 1] - ms[i + 1] * dxs[i] / 3,
                // End point
                xs[i + 1],
                ys[i + 1],

                false,
                valueData[i + 1]
              );
            }

            return path;
          }
        };
      };

      /**
       * Step interpolation will cause the line chart to move in steps rather than diagonal or smoothed lines. This interpolation will create additional points that will also be drawn when the `showPoint` option is enabled.
       *
       * All smoothing functions within Chartist are factory functions that accept an options parameter. The step interpolation function accepts one configuration parameter `postpone`, that can be `true` or `false`. The default value is `true` and will cause the step to occur where the value actually changes. If a different behaviour is needed where the step is shifted to the left and happens before the actual value, this option can be set to `false`.
       *
       * @example
       * var chart = new Chartist.Line('.ct-chart', {
       *   labels: [1, 2, 3, 4, 5],
       *   series: [[1, 2, 8, 1, 7]]
       * }, {
       *   lineSmooth: Chartist.Interpolation.step({
       *     postpone: true,
       *     fillHoles: false
       *   })
       * });
       *
       * @memberof Chartist.Interpolation
       * @param options
       * @returns {Function}
       */
      Chartist.Interpolation.step = function(options) {
        var defaultOptions = {
          postpone: true,
          fillHoles: false
        };

        options = Chartist.extend({}, defaultOptions, options);

        return function step(pathCoordinates, valueData) {
          var path = new Chartist.Svg.Path();

          var prevX, prevY, prevData;

          for (var i = 0; i < pathCoordinates.length; i += 2) {
            var currX = pathCoordinates[i];
            var currY = pathCoordinates[i + 1];
            var currData = valueData[i / 2];

            // If the current point is also not a hole we can draw the step lines
            if(currData.value !== undefined) {
              if(prevData === undefined) {
                path.move(currX, currY, false, currData);
              } else {
                if(options.postpone) {
                  // If postponed we should draw the step line with the value of the previous value
                  path.line(currX, prevY, false, prevData);
                } else {
                  // If not postponed we should draw the step line with the value of the current value
                  path.line(prevX, currY, false, currData);
                }
                // Line to the actual point (this should only be a Y-Axis movement
                path.line(currX, currY, false, currData);
              }

              prevX = currX;
              prevY = currY;
              prevData = currData;
            } else if(!options.fillHoles) {
              prevX = prevY = prevData = undefined;
            }
          }

          return path;
        };
      };

    }(this || commonjsGlobal, Chartist));
    /* global Chartist */
    (function (globalRoot, Chartist) {

      Chartist.EventEmitter = function () {
        var handlers = [];

        /**
         * Add an event handler for a specific event
         *
         * @memberof Chartist.Event
         * @param {String} event The event name
         * @param {Function} handler A event handler function
         */
        function addEventHandler(event, handler) {
          handlers[event] = handlers[event] || [];
          handlers[event].push(handler);
        }

        /**
         * Remove an event handler of a specific event name or remove all event handlers for a specific event.
         *
         * @memberof Chartist.Event
         * @param {String} event The event name where a specific or all handlers should be removed
         * @param {Function} [handler] An optional event handler function. If specified only this specific handler will be removed and otherwise all handlers are removed.
         */
        function removeEventHandler(event, handler) {
          // Only do something if there are event handlers with this name existing
          if(handlers[event]) {
            // If handler is set we will look for a specific handler and only remove this
            if(handler) {
              handlers[event].splice(handlers[event].indexOf(handler), 1);
              if(handlers[event].length === 0) {
                delete handlers[event];
              }
            } else {
              // If no handler is specified we remove all handlers for this event
              delete handlers[event];
            }
          }
        }

        /**
         * Use this function to emit an event. All handlers that are listening for this event will be triggered with the data parameter.
         *
         * @memberof Chartist.Event
         * @param {String} event The event name that should be triggered
         * @param {*} data Arbitrary data that will be passed to the event handler callback functions
         */
        function emit(event, data) {
          // Only do something if there are event handlers with this name existing
          if(handlers[event]) {
            handlers[event].forEach(function(handler) {
              handler(data);
            });
          }

          // Emit event to star event handlers
          if(handlers['*']) {
            handlers['*'].forEach(function(starHandler) {
              starHandler(event, data);
            });
          }
        }

        return {
          addEventHandler: addEventHandler,
          removeEventHandler: removeEventHandler,
          emit: emit
        };
      };

    }(this || commonjsGlobal, Chartist));
    /* global Chartist */
    (function(globalRoot, Chartist) {

      function listToArray(list) {
        var arr = [];
        if (list.length) {
          for (var i = 0; i < list.length; i++) {
            arr.push(list[i]);
          }
        }
        return arr;
      }

      /**
       * Method to extend from current prototype.
       *
       * @memberof Chartist.Class
       * @param {Object} properties The object that serves as definition for the prototype that gets created for the new class. This object should always contain a constructor property that is the desired constructor for the newly created class.
       * @param {Object} [superProtoOverride] By default extens will use the current class prototype or Chartist.class. With this parameter you can specify any super prototype that will be used.
       * @return {Function} Constructor function of the new class
       *
       * @example
       * var Fruit = Class.extend({
         * color: undefined,
         *   sugar: undefined,
         *
         *   constructor: function(color, sugar) {
         *     this.color = color;
         *     this.sugar = sugar;
         *   },
         *
         *   eat: function() {
         *     this.sugar = 0;
         *     return this;
         *   }
         * });
       *
       * var Banana = Fruit.extend({
         *   length: undefined,
         *
         *   constructor: function(length, sugar) {
         *     Banana.super.constructor.call(this, 'Yellow', sugar);
         *     this.length = length;
         *   }
         * });
       *
       * var banana = new Banana(20, 40);
       * console.log('banana instanceof Fruit', banana instanceof Fruit);
       * console.log('Fruit is prototype of banana', Fruit.prototype.isPrototypeOf(banana));
       * console.log('bananas prototype is Fruit', Object.getPrototypeOf(banana) === Fruit.prototype);
       * console.log(banana.sugar);
       * console.log(banana.eat().sugar);
       * console.log(banana.color);
       */
      function extend(properties, superProtoOverride) {
        var superProto = superProtoOverride || this.prototype || Chartist.Class;
        var proto = Object.create(superProto);

        Chartist.Class.cloneDefinitions(proto, properties);

        var constr = function() {
          var fn = proto.constructor || function () {},
            instance;

          // If this is linked to the Chartist namespace the constructor was not called with new
          // To provide a fallback we will instantiate here and return the instance
          instance = this === Chartist ? Object.create(proto) : this;
          fn.apply(instance, Array.prototype.slice.call(arguments, 0));

          // If this constructor was not called with new we need to return the instance
          // This will not harm when the constructor has been called with new as the returned value is ignored
          return instance;
        };

        constr.prototype = proto;
        constr.super = superProto;
        constr.extend = this.extend;

        return constr;
      }

      // Variable argument list clones args > 0 into args[0] and retruns modified args[0]
      function cloneDefinitions() {
        var args = listToArray(arguments);
        var target = args[0];

        args.splice(1, args.length - 1).forEach(function (source) {
          Object.getOwnPropertyNames(source).forEach(function (propName) {
            // If this property already exist in target we delete it first
            delete target[propName];
            // Define the property with the descriptor from source
            Object.defineProperty(target, propName,
              Object.getOwnPropertyDescriptor(source, propName));
          });
        });

        return target;
      }

      Chartist.Class = {
        extend: extend,
        cloneDefinitions: cloneDefinitions
      };

    }(this || commonjsGlobal, Chartist));
    /* global Chartist */
    (function(globalRoot, Chartist) {

      var window = globalRoot.window;

      // TODO: Currently we need to re-draw the chart on window resize. This is usually very bad and will affect performance.
      // This is done because we can't work with relative coordinates when drawing the chart because SVG Path does not
      // work with relative positions yet. We need to check if we can do a viewBox hack to switch to percentage.
      // See http://mozilla.6506.n7.nabble.com/Specyfing-paths-with-percentages-unit-td247474.html
      // Update: can be done using the above method tested here: http://codepen.io/gionkunz/pen/KDvLj
      // The problem is with the label offsets that can't be converted into percentage and affecting the chart container
      /**
       * Updates the chart which currently does a full reconstruction of the SVG DOM
       *
       * @param {Object} [data] Optional data you'd like to set for the chart before it will update. If not specified the update method will use the data that is already configured with the chart.
       * @param {Object} [options] Optional options you'd like to add to the previous options for the chart before it will update. If not specified the update method will use the options that have been already configured with the chart.
       * @param {Boolean} [override] If set to true, the passed options will be used to extend the options that have been configured already. Otherwise the chart default options will be used as the base
       * @memberof Chartist.Base
       */
      function update(data, options, override) {
        if(data) {
          this.data = data || {};
          this.data.labels = this.data.labels || [];
          this.data.series = this.data.series || [];
          // Event for data transformation that allows to manipulate the data before it gets rendered in the charts
          this.eventEmitter.emit('data', {
            type: 'update',
            data: this.data
          });
        }

        if(options) {
          this.options = Chartist.extend({}, override ? this.options : this.defaultOptions, options);

          // If chartist was not initialized yet, we just set the options and leave the rest to the initialization
          // Otherwise we re-create the optionsProvider at this point
          if(!this.initializeTimeoutId) {
            this.optionsProvider.removeMediaQueryListeners();
            this.optionsProvider = Chartist.optionsProvider(this.options, this.responsiveOptions, this.eventEmitter);
          }
        }

        // Only re-created the chart if it has been initialized yet
        if(!this.initializeTimeoutId) {
          this.createChart(this.optionsProvider.getCurrentOptions());
        }

        // Return a reference to the chart object to chain up calls
        return this;
      }

      /**
       * This method can be called on the API object of each chart and will un-register all event listeners that were added to other components. This currently includes a window.resize listener as well as media query listeners if any responsive options have been provided. Use this function if you need to destroy and recreate Chartist charts dynamically.
       *
       * @memberof Chartist.Base
       */
      function detach() {
        // Only detach if initialization already occurred on this chart. If this chart still hasn't initialized (therefore
        // the initializationTimeoutId is still a valid timeout reference, we will clear the timeout
        if(!this.initializeTimeoutId) {
          window.removeEventListener('resize', this.resizeListener);
          this.optionsProvider.removeMediaQueryListeners();
        } else {
          window.clearTimeout(this.initializeTimeoutId);
        }

        return this;
      }

      /**
       * Use this function to register event handlers. The handler callbacks are synchronous and will run in the main thread rather than the event loop.
       *
       * @memberof Chartist.Base
       * @param {String} event Name of the event. Check the examples for supported events.
       * @param {Function} handler The handler function that will be called when an event with the given name was emitted. This function will receive a data argument which contains event data. See the example for more details.
       */
      function on(event, handler) {
        this.eventEmitter.addEventHandler(event, handler);
        return this;
      }

      /**
       * Use this function to un-register event handlers. If the handler function parameter is omitted all handlers for the given event will be un-registered.
       *
       * @memberof Chartist.Base
       * @param {String} event Name of the event for which a handler should be removed
       * @param {Function} [handler] The handler function that that was previously used to register a new event handler. This handler will be removed from the event handler list. If this parameter is omitted then all event handlers for the given event are removed from the list.
       */
      function off(event, handler) {
        this.eventEmitter.removeEventHandler(event, handler);
        return this;
      }

      function initialize() {
        // Add window resize listener that re-creates the chart
        window.addEventListener('resize', this.resizeListener);

        // Obtain current options based on matching media queries (if responsive options are given)
        // This will also register a listener that is re-creating the chart based on media changes
        this.optionsProvider = Chartist.optionsProvider(this.options, this.responsiveOptions, this.eventEmitter);
        // Register options change listener that will trigger a chart update
        this.eventEmitter.addEventHandler('optionsChanged', function() {
          this.update();
        }.bind(this));

        // Before the first chart creation we need to register us with all plugins that are configured
        // Initialize all relevant plugins with our chart object and the plugin options specified in the config
        if(this.options.plugins) {
          this.options.plugins.forEach(function(plugin) {
            if(plugin instanceof Array) {
              plugin[0](this, plugin[1]);
            } else {
              plugin(this);
            }
          }.bind(this));
        }

        // Event for data transformation that allows to manipulate the data before it gets rendered in the charts
        this.eventEmitter.emit('data', {
          type: 'initial',
          data: this.data
        });

        // Create the first chart
        this.createChart(this.optionsProvider.getCurrentOptions());

        // As chart is initialized from the event loop now we can reset our timeout reference
        // This is important if the chart gets initialized on the same element twice
        this.initializeTimeoutId = undefined;
      }

      /**
       * Constructor of chart base class.
       *
       * @param query
       * @param data
       * @param defaultOptions
       * @param options
       * @param responsiveOptions
       * @constructor
       */
      function Base(query, data, defaultOptions, options, responsiveOptions) {
        this.container = Chartist.querySelector(query);
        this.data = data || {};
        this.data.labels = this.data.labels || [];
        this.data.series = this.data.series || [];
        this.defaultOptions = defaultOptions;
        this.options = options;
        this.responsiveOptions = responsiveOptions;
        this.eventEmitter = Chartist.EventEmitter();
        this.supportsForeignObject = Chartist.Svg.isSupported('Extensibility');
        this.supportsAnimations = Chartist.Svg.isSupported('AnimationEventsAttribute');
        this.resizeListener = function resizeListener(){
          this.update();
        }.bind(this);

        if(this.container) {
          // If chartist was already initialized in this container we are detaching all event listeners first
          if(this.container.__chartist__) {
            this.container.__chartist__.detach();
          }

          this.container.__chartist__ = this;
        }

        // Using event loop for first draw to make it possible to register event listeners in the same call stack where
        // the chart was created.
        this.initializeTimeoutId = setTimeout(initialize.bind(this), 0);
      }

      // Creating the chart base class
      Chartist.Base = Chartist.Class.extend({
        constructor: Base,
        optionsProvider: undefined,
        container: undefined,
        svg: undefined,
        eventEmitter: undefined,
        createChart: function() {
          throw new Error('Base chart type can\'t be instantiated!');
        },
        update: update,
        detach: detach,
        on: on,
        off: off,
        version: Chartist.version,
        supportsForeignObject: false
      });

    }(this || commonjsGlobal, Chartist));
    /* global Chartist */
    (function(globalRoot, Chartist) {

      var document = globalRoot.document;

      /**
       * Chartist.Svg creates a new SVG object wrapper with a starting element. You can use the wrapper to fluently create sub-elements and modify them.
       *
       * @memberof Chartist.Svg
       * @constructor
       * @param {String|Element} name The name of the SVG element to create or an SVG dom element which should be wrapped into Chartist.Svg
       * @param {Object} attributes An object with properties that will be added as attributes to the SVG element that is created. Attributes with undefined values will not be added.
       * @param {String} className This class or class list will be added to the SVG element
       * @param {Object} parent The parent SVG wrapper object where this newly created wrapper and it's element will be attached to as child
       * @param {Boolean} insertFirst If this param is set to true in conjunction with a parent element the newly created element will be added as first child element in the parent element
       */
      function Svg(name, attributes, className, parent, insertFirst) {
        // If Svg is getting called with an SVG element we just return the wrapper
        if(name instanceof Element) {
          this._node = name;
        } else {
          this._node = document.createElementNS(Chartist.namespaces.svg, name);

          // If this is an SVG element created then custom namespace
          if(name === 'svg') {
            this.attr({
              'xmlns:ct': Chartist.namespaces.ct
            });
          }
        }

        if(attributes) {
          this.attr(attributes);
        }

        if(className) {
          this.addClass(className);
        }

        if(parent) {
          if (insertFirst && parent._node.firstChild) {
            parent._node.insertBefore(this._node, parent._node.firstChild);
          } else {
            parent._node.appendChild(this._node);
          }
        }
      }

      /**
       * Set attributes on the current SVG element of the wrapper you're currently working on.
       *
       * @memberof Chartist.Svg
       * @param {Object|String} attributes An object with properties that will be added as attributes to the SVG element that is created. Attributes with undefined values will not be added. If this parameter is a String then the function is used as a getter and will return the attribute value.
       * @param {String} [ns] If specified, the attribute will be obtained using getAttributeNs. In order to write namepsaced attributes you can use the namespace:attribute notation within the attributes object.
       * @return {Object|String} The current wrapper object will be returned so it can be used for chaining or the attribute value if used as getter function.
       */
      function attr(attributes, ns) {
        if(typeof attributes === 'string') {
          if(ns) {
            return this._node.getAttributeNS(ns, attributes);
          } else {
            return this._node.getAttribute(attributes);
          }
        }

        Object.keys(attributes).forEach(function(key) {
          // If the attribute value is undefined we can skip this one
          if(attributes[key] === undefined) {
            return;
          }

          if (key.indexOf(':') !== -1) {
            var namespacedAttribute = key.split(':');
            this._node.setAttributeNS(Chartist.namespaces[namespacedAttribute[0]], key, attributes[key]);
          } else {
            this._node.setAttribute(key, attributes[key]);
          }
        }.bind(this));

        return this;
      }

      /**
       * Create a new SVG element whose wrapper object will be selected for further operations. This way you can also create nested groups easily.
       *
       * @memberof Chartist.Svg
       * @param {String} name The name of the SVG element that should be created as child element of the currently selected element wrapper
       * @param {Object} [attributes] An object with properties that will be added as attributes to the SVG element that is created. Attributes with undefined values will not be added.
       * @param {String} [className] This class or class list will be added to the SVG element
       * @param {Boolean} [insertFirst] If this param is set to true in conjunction with a parent element the newly created element will be added as first child element in the parent element
       * @return {Chartist.Svg} Returns a Chartist.Svg wrapper object that can be used to modify the containing SVG data
       */
      function elem(name, attributes, className, insertFirst) {
        return new Chartist.Svg(name, attributes, className, this, insertFirst);
      }

      /**
       * Returns the parent Chartist.SVG wrapper object
       *
       * @memberof Chartist.Svg
       * @return {Chartist.Svg} Returns a Chartist.Svg wrapper around the parent node of the current node. If the parent node is not existing or it's not an SVG node then this function will return null.
       */
      function parent() {
        return this._node.parentNode instanceof SVGElement ? new Chartist.Svg(this._node.parentNode) : null;
      }

      /**
       * This method returns a Chartist.Svg wrapper around the root SVG element of the current tree.
       *
       * @memberof Chartist.Svg
       * @return {Chartist.Svg} The root SVG element wrapped in a Chartist.Svg element
       */
      function root() {
        var node = this._node;
        while(node.nodeName !== 'svg') {
          node = node.parentNode;
        }
        return new Chartist.Svg(node);
      }

      /**
       * Find the first child SVG element of the current element that matches a CSS selector. The returned object is a Chartist.Svg wrapper.
       *
       * @memberof Chartist.Svg
       * @param {String} selector A CSS selector that is used to query for child SVG elements
       * @return {Chartist.Svg} The SVG wrapper for the element found or null if no element was found
       */
      function querySelector(selector) {
        var foundNode = this._node.querySelector(selector);
        return foundNode ? new Chartist.Svg(foundNode) : null;
      }

      /**
       * Find the all child SVG elements of the current element that match a CSS selector. The returned object is a Chartist.Svg.List wrapper.
       *
       * @memberof Chartist.Svg
       * @param {String} selector A CSS selector that is used to query for child SVG elements
       * @return {Chartist.Svg.List} The SVG wrapper list for the element found or null if no element was found
       */
      function querySelectorAll(selector) {
        var foundNodes = this._node.querySelectorAll(selector);
        return foundNodes.length ? new Chartist.Svg.List(foundNodes) : null;
      }

      /**
       * Returns the underlying SVG node for the current element.
       *
       * @memberof Chartist.Svg
       * @returns {Node}
       */
      function getNode() {
        return this._node;
      }

      /**
       * This method creates a foreignObject (see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/foreignObject) that allows to embed HTML content into a SVG graphic. With the help of foreignObjects you can enable the usage of regular HTML elements inside of SVG where they are subject for SVG positioning and transformation but the Browser will use the HTML rendering capabilities for the containing DOM.
       *
       * @memberof Chartist.Svg
       * @param {Node|String} content The DOM Node, or HTML string that will be converted to a DOM Node, that is then placed into and wrapped by the foreignObject
       * @param {String} [attributes] An object with properties that will be added as attributes to the foreignObject element that is created. Attributes with undefined values will not be added.
       * @param {String} [className] This class or class list will be added to the SVG element
       * @param {Boolean} [insertFirst] Specifies if the foreignObject should be inserted as first child
       * @return {Chartist.Svg} New wrapper object that wraps the foreignObject element
       */
      function foreignObject(content, attributes, className, insertFirst) {
        // If content is string then we convert it to DOM
        // TODO: Handle case where content is not a string nor a DOM Node
        if(typeof content === 'string') {
          var container = document.createElement('div');
          container.innerHTML = content;
          content = container.firstChild;
        }

        // Adding namespace to content element
        content.setAttribute('xmlns', Chartist.namespaces.xmlns);

        // Creating the foreignObject without required extension attribute (as described here
        // http://www.w3.org/TR/SVG/extend.html#ForeignObjectElement)
        var fnObj = this.elem('foreignObject', attributes, className, insertFirst);

        // Add content to foreignObjectElement
        fnObj._node.appendChild(content);

        return fnObj;
      }

      /**
       * This method adds a new text element to the current Chartist.Svg wrapper.
       *
       * @memberof Chartist.Svg
       * @param {String} t The text that should be added to the text element that is created
       * @return {Chartist.Svg} The same wrapper object that was used to add the newly created element
       */
      function text(t) {
        this._node.appendChild(document.createTextNode(t));
        return this;
      }

      /**
       * This method will clear all child nodes of the current wrapper object.
       *
       * @memberof Chartist.Svg
       * @return {Chartist.Svg} The same wrapper object that got emptied
       */
      function empty() {
        while (this._node.firstChild) {
          this._node.removeChild(this._node.firstChild);
        }

        return this;
      }

      /**
       * This method will cause the current wrapper to remove itself from its parent wrapper. Use this method if you'd like to get rid of an element in a given DOM structure.
       *
       * @memberof Chartist.Svg
       * @return {Chartist.Svg} The parent wrapper object of the element that got removed
       */
      function remove() {
        this._node.parentNode.removeChild(this._node);
        return this.parent();
      }

      /**
       * This method will replace the element with a new element that can be created outside of the current DOM.
       *
       * @memberof Chartist.Svg
       * @param {Chartist.Svg} newElement The new Chartist.Svg object that will be used to replace the current wrapper object
       * @return {Chartist.Svg} The wrapper of the new element
       */
      function replace(newElement) {
        this._node.parentNode.replaceChild(newElement._node, this._node);
        return newElement;
      }

      /**
       * This method will append an element to the current element as a child.
       *
       * @memberof Chartist.Svg
       * @param {Chartist.Svg} element The Chartist.Svg element that should be added as a child
       * @param {Boolean} [insertFirst] Specifies if the element should be inserted as first child
       * @return {Chartist.Svg} The wrapper of the appended object
       */
      function append(element, insertFirst) {
        if(insertFirst && this._node.firstChild) {
          this._node.insertBefore(element._node, this._node.firstChild);
        } else {
          this._node.appendChild(element._node);
        }

        return this;
      }

      /**
       * Returns an array of class names that are attached to the current wrapper element. This method can not be chained further.
       *
       * @memberof Chartist.Svg
       * @return {Array} A list of classes or an empty array if there are no classes on the current element
       */
      function classes() {
        return this._node.getAttribute('class') ? this._node.getAttribute('class').trim().split(/\s+/) : [];
      }

      /**
       * Adds one or a space separated list of classes to the current element and ensures the classes are only existing once.
       *
       * @memberof Chartist.Svg
       * @param {String} names A white space separated list of class names
       * @return {Chartist.Svg} The wrapper of the current element
       */
      function addClass(names) {
        this._node.setAttribute('class',
          this.classes(this._node)
            .concat(names.trim().split(/\s+/))
            .filter(function(elem, pos, self) {
              return self.indexOf(elem) === pos;
            }).join(' ')
        );

        return this;
      }

      /**
       * Removes one or a space separated list of classes from the current element.
       *
       * @memberof Chartist.Svg
       * @param {String} names A white space separated list of class names
       * @return {Chartist.Svg} The wrapper of the current element
       */
      function removeClass(names) {
        var removedClasses = names.trim().split(/\s+/);

        this._node.setAttribute('class', this.classes(this._node).filter(function(name) {
          return removedClasses.indexOf(name) === -1;
        }).join(' '));

        return this;
      }

      /**
       * Removes all classes from the current element.
       *
       * @memberof Chartist.Svg
       * @return {Chartist.Svg} The wrapper of the current element
       */
      function removeAllClasses() {
        this._node.setAttribute('class', '');

        return this;
      }

      /**
       * Get element height using `getBoundingClientRect`
       *
       * @memberof Chartist.Svg
       * @return {Number} The elements height in pixels
       */
      function height() {
        return this._node.getBoundingClientRect().height;
      }

      /**
       * Get element width using `getBoundingClientRect`
       *
       * @memberof Chartist.Core
       * @return {Number} The elements width in pixels
       */
      function width() {
        return this._node.getBoundingClientRect().width;
      }

      /**
       * The animate function lets you animate the current element with SMIL animations. You can add animations for multiple attributes at the same time by using an animation definition object. This object should contain SMIL animation attributes. Please refer to http://www.w3.org/TR/SVG/animate.html for a detailed specification about the available animation attributes. Additionally an easing property can be passed in the animation definition object. This can be a string with a name of an easing function in `Chartist.Svg.Easing` or an array with four numbers specifying a cubic Bézier curve.
       * **An animations object could look like this:**
       * ```javascript
       * element.animate({
       *   opacity: {
       *     dur: 1000,
       *     from: 0,
       *     to: 1
       *   },
       *   x1: {
       *     dur: '1000ms',
       *     from: 100,
       *     to: 200,
       *     easing: 'easeOutQuart'
       *   },
       *   y1: {
       *     dur: '2s',
       *     from: 0,
       *     to: 100
       *   }
       * });
       * ```
       * **Automatic unit conversion**
       * For the `dur` and the `begin` animate attribute you can also omit a unit by passing a number. The number will automatically be converted to milli seconds.
       * **Guided mode**
       * The default behavior of SMIL animations with offset using the `begin` attribute is that the attribute will keep it's original value until the animation starts. Mostly this behavior is not desired as you'd like to have your element attributes already initialized with the animation `from` value even before the animation starts. Also if you don't specify `fill="freeze"` on an animate element or if you delete the animation after it's done (which is done in guided mode) the attribute will switch back to the initial value. This behavior is also not desired when performing simple one-time animations. For one-time animations you'd want to trigger animations immediately instead of relative to the document begin time. That's why in guided mode Chartist.Svg will also use the `begin` property to schedule a timeout and manually start the animation after the timeout. If you're using multiple SMIL definition objects for an attribute (in an array), guided mode will be disabled for this attribute, even if you explicitly enabled it.
       * If guided mode is enabled the following behavior is added:
       * - Before the animation starts (even when delayed with `begin`) the animated attribute will be set already to the `from` value of the animation
       * - `begin` is explicitly set to `indefinite` so it can be started manually without relying on document begin time (creation)
       * - The animate element will be forced to use `fill="freeze"`
       * - The animation will be triggered with `beginElement()` in a timeout where `begin` of the definition object is interpreted in milli seconds. If no `begin` was specified the timeout is triggered immediately.
       * - After the animation the element attribute value will be set to the `to` value of the animation
       * - The animate element is deleted from the DOM
       *
       * @memberof Chartist.Svg
       * @param {Object} animations An animations object where the property keys are the attributes you'd like to animate. The properties should be objects again that contain the SMIL animation attributes (usually begin, dur, from, and to). The property begin and dur is auto converted (see Automatic unit conversion). You can also schedule multiple animations for the same attribute by passing an Array of SMIL definition objects. Attributes that contain an array of SMIL definition objects will not be executed in guided mode.
       * @param {Boolean} guided Specify if guided mode should be activated for this animation (see Guided mode). If not otherwise specified, guided mode will be activated.
       * @param {Object} eventEmitter If specified, this event emitter will be notified when an animation starts or ends.
       * @return {Chartist.Svg} The current element where the animation was added
       */
      function animate(animations, guided, eventEmitter) {
        if(guided === undefined) {
          guided = true;
        }

        Object.keys(animations).forEach(function createAnimateForAttributes(attribute) {

          function createAnimate(animationDefinition, guided) {
            var attributeProperties = {},
              animate,
              timeout,
              easing;

            // Check if an easing is specified in the definition object and delete it from the object as it will not
            // be part of the animate element attributes.
            if(animationDefinition.easing) {
              // If already an easing Bézier curve array we take it or we lookup a easing array in the Easing object
              easing = animationDefinition.easing instanceof Array ?
                animationDefinition.easing :
                Chartist.Svg.Easing[animationDefinition.easing];
              delete animationDefinition.easing;
            }

            // If numeric dur or begin was provided we assume milli seconds
            animationDefinition.begin = Chartist.ensureUnit(animationDefinition.begin, 'ms');
            animationDefinition.dur = Chartist.ensureUnit(animationDefinition.dur, 'ms');

            if(easing) {
              animationDefinition.calcMode = 'spline';
              animationDefinition.keySplines = easing.join(' ');
              animationDefinition.keyTimes = '0;1';
            }

            // Adding "fill: freeze" if we are in guided mode and set initial attribute values
            if(guided) {
              animationDefinition.fill = 'freeze';
              // Animated property on our element should already be set to the animation from value in guided mode
              attributeProperties[attribute] = animationDefinition.from;
              this.attr(attributeProperties);

              // In guided mode we also set begin to indefinite so we can trigger the start manually and put the begin
              // which needs to be in ms aside
              timeout = Chartist.quantity(animationDefinition.begin || 0).value;
              animationDefinition.begin = 'indefinite';
            }

            animate = this.elem('animate', Chartist.extend({
              attributeName: attribute
            }, animationDefinition));

            if(guided) {
              // If guided we take the value that was put aside in timeout and trigger the animation manually with a timeout
              setTimeout(function() {
                // If beginElement fails we set the animated attribute to the end position and remove the animate element
                // This happens if the SMIL ElementTimeControl interface is not supported or any other problems occured in
                // the browser. (Currently FF 34 does not support animate elements in foreignObjects)
                try {
                  animate._node.beginElement();
                } catch(err) {
                  // Set animated attribute to current animated value
                  attributeProperties[attribute] = animationDefinition.to;
                  this.attr(attributeProperties);
                  // Remove the animate element as it's no longer required
                  animate.remove();
                }
              }.bind(this), timeout);
            }

            if(eventEmitter) {
              animate._node.addEventListener('beginEvent', function handleBeginEvent() {
                eventEmitter.emit('animationBegin', {
                  element: this,
                  animate: animate._node,
                  params: animationDefinition
                });
              }.bind(this));
            }

            animate._node.addEventListener('endEvent', function handleEndEvent() {
              if(eventEmitter) {
                eventEmitter.emit('animationEnd', {
                  element: this,
                  animate: animate._node,
                  params: animationDefinition
                });
              }

              if(guided) {
                // Set animated attribute to current animated value
                attributeProperties[attribute] = animationDefinition.to;
                this.attr(attributeProperties);
                // Remove the animate element as it's no longer required
                animate.remove();
              }
            }.bind(this));
          }

          // If current attribute is an array of definition objects we create an animate for each and disable guided mode
          if(animations[attribute] instanceof Array) {
            animations[attribute].forEach(function(animationDefinition) {
              createAnimate.bind(this)(animationDefinition, false);
            }.bind(this));
          } else {
            createAnimate.bind(this)(animations[attribute], guided);
          }

        }.bind(this));

        return this;
      }

      Chartist.Svg = Chartist.Class.extend({
        constructor: Svg,
        attr: attr,
        elem: elem,
        parent: parent,
        root: root,
        querySelector: querySelector,
        querySelectorAll: querySelectorAll,
        getNode: getNode,
        foreignObject: foreignObject,
        text: text,
        empty: empty,
        remove: remove,
        replace: replace,
        append: append,
        classes: classes,
        addClass: addClass,
        removeClass: removeClass,
        removeAllClasses: removeAllClasses,
        height: height,
        width: width,
        animate: animate
      });

      /**
       * This method checks for support of a given SVG feature like Extensibility, SVG-animation or the like. Check http://www.w3.org/TR/SVG11/feature for a detailed list.
       *
       * @memberof Chartist.Svg
       * @param {String} feature The SVG 1.1 feature that should be checked for support.
       * @return {Boolean} True of false if the feature is supported or not
       */
      Chartist.Svg.isSupported = function(feature) {
        return document.implementation.hasFeature('http://www.w3.org/TR/SVG11/feature#' + feature, '1.1');
      };

      /**
       * This Object contains some standard easing cubic bezier curves. Then can be used with their name in the `Chartist.Svg.animate`. You can also extend the list and use your own name in the `animate` function. Click the show code button to see the available bezier functions.
       *
       * @memberof Chartist.Svg
       */
      var easingCubicBeziers = {
        easeInSine: [0.47, 0, 0.745, 0.715],
        easeOutSine: [0.39, 0.575, 0.565, 1],
        easeInOutSine: [0.445, 0.05, 0.55, 0.95],
        easeInQuad: [0.55, 0.085, 0.68, 0.53],
        easeOutQuad: [0.25, 0.46, 0.45, 0.94],
        easeInOutQuad: [0.455, 0.03, 0.515, 0.955],
        easeInCubic: [0.55, 0.055, 0.675, 0.19],
        easeOutCubic: [0.215, 0.61, 0.355, 1],
        easeInOutCubic: [0.645, 0.045, 0.355, 1],
        easeInQuart: [0.895, 0.03, 0.685, 0.22],
        easeOutQuart: [0.165, 0.84, 0.44, 1],
        easeInOutQuart: [0.77, 0, 0.175, 1],
        easeInQuint: [0.755, 0.05, 0.855, 0.06],
        easeOutQuint: [0.23, 1, 0.32, 1],
        easeInOutQuint: [0.86, 0, 0.07, 1],
        easeInExpo: [0.95, 0.05, 0.795, 0.035],
        easeOutExpo: [0.19, 1, 0.22, 1],
        easeInOutExpo: [1, 0, 0, 1],
        easeInCirc: [0.6, 0.04, 0.98, 0.335],
        easeOutCirc: [0.075, 0.82, 0.165, 1],
        easeInOutCirc: [0.785, 0.135, 0.15, 0.86],
        easeInBack: [0.6, -0.28, 0.735, 0.045],
        easeOutBack: [0.175, 0.885, 0.32, 1.275],
        easeInOutBack: [0.68, -0.55, 0.265, 1.55]
      };

      Chartist.Svg.Easing = easingCubicBeziers;

      /**
       * This helper class is to wrap multiple `Chartist.Svg` elements into a list where you can call the `Chartist.Svg` functions on all elements in the list with one call. This is helpful when you'd like to perform calls with `Chartist.Svg` on multiple elements.
       * An instance of this class is also returned by `Chartist.Svg.querySelectorAll`.
       *
       * @memberof Chartist.Svg
       * @param {Array<Node>|NodeList} nodeList An Array of SVG DOM nodes or a SVG DOM NodeList (as returned by document.querySelectorAll)
       * @constructor
       */
      function SvgList(nodeList) {
        var list = this;

        this.svgElements = [];
        for(var i = 0; i < nodeList.length; i++) {
          this.svgElements.push(new Chartist.Svg(nodeList[i]));
        }

        // Add delegation methods for Chartist.Svg
        Object.keys(Chartist.Svg.prototype).filter(function(prototypeProperty) {
          return ['constructor',
              'parent',
              'querySelector',
              'querySelectorAll',
              'replace',
              'append',
              'classes',
              'height',
              'width'].indexOf(prototypeProperty) === -1;
        }).forEach(function(prototypeProperty) {
          list[prototypeProperty] = function() {
            var args = Array.prototype.slice.call(arguments, 0);
            list.svgElements.forEach(function(element) {
              Chartist.Svg.prototype[prototypeProperty].apply(element, args);
            });
            return list;
          };
        });
      }

      Chartist.Svg.List = Chartist.Class.extend({
        constructor: SvgList
      });
    }(this || commonjsGlobal, Chartist));
    /* global Chartist */
    (function(globalRoot, Chartist) {

      /**
       * Contains the descriptors of supported element types in a SVG path. Currently only move, line and curve are supported.
       *
       * @memberof Chartist.Svg.Path
       * @type {Object}
       */
      var elementDescriptions = {
        m: ['x', 'y'],
        l: ['x', 'y'],
        c: ['x1', 'y1', 'x2', 'y2', 'x', 'y'],
        a: ['rx', 'ry', 'xAr', 'lAf', 'sf', 'x', 'y']
      };

      /**
       * Default options for newly created SVG path objects.
       *
       * @memberof Chartist.Svg.Path
       * @type {Object}
       */
      var defaultOptions = {
        // The accuracy in digit count after the decimal point. This will be used to round numbers in the SVG path. If this option is set to false then no rounding will be performed.
        accuracy: 3
      };

      function element(command, params, pathElements, pos, relative, data) {
        var pathElement = Chartist.extend({
          command: relative ? command.toLowerCase() : command.toUpperCase()
        }, params, data ? { data: data } : {} );

        pathElements.splice(pos, 0, pathElement);
      }

      function forEachParam(pathElements, cb) {
        pathElements.forEach(function(pathElement, pathElementIndex) {
          elementDescriptions[pathElement.command.toLowerCase()].forEach(function(paramName, paramIndex) {
            cb(pathElement, paramName, pathElementIndex, paramIndex, pathElements);
          });
        });
      }

      /**
       * Used to construct a new path object.
       *
       * @memberof Chartist.Svg.Path
       * @param {Boolean} close If set to true then this path will be closed when stringified (with a Z at the end)
       * @param {Object} options Options object that overrides the default objects. See default options for more details.
       * @constructor
       */
      function SvgPath(close, options) {
        this.pathElements = [];
        this.pos = 0;
        this.close = close;
        this.options = Chartist.extend({}, defaultOptions, options);
      }

      /**
       * Gets or sets the current position (cursor) inside of the path. You can move around the cursor freely but limited to 0 or the count of existing elements. All modifications with element functions will insert new elements at the position of this cursor.
       *
       * @memberof Chartist.Svg.Path
       * @param {Number} [pos] If a number is passed then the cursor is set to this position in the path element array.
       * @return {Chartist.Svg.Path|Number} If the position parameter was passed then the return value will be the path object for easy call chaining. If no position parameter was passed then the current position is returned.
       */
      function position(pos) {
        if(pos !== undefined) {
          this.pos = Math.max(0, Math.min(this.pathElements.length, pos));
          return this;
        } else {
          return this.pos;
        }
      }

      /**
       * Removes elements from the path starting at the current position.
       *
       * @memberof Chartist.Svg.Path
       * @param {Number} count Number of path elements that should be removed from the current position.
       * @return {Chartist.Svg.Path} The current path object for easy call chaining.
       */
      function remove(count) {
        this.pathElements.splice(this.pos, count);
        return this;
      }

      /**
       * Use this function to add a new move SVG path element.
       *
       * @memberof Chartist.Svg.Path
       * @param {Number} x The x coordinate for the move element.
       * @param {Number} y The y coordinate for the move element.
       * @param {Boolean} [relative] If set to true the move element will be created with relative coordinates (lowercase letter)
       * @param {*} [data] Any data that should be stored with the element object that will be accessible in pathElement
       * @return {Chartist.Svg.Path} The current path object for easy call chaining.
       */
      function move(x, y, relative, data) {
        element('M', {
          x: +x,
          y: +y
        }, this.pathElements, this.pos++, relative, data);
        return this;
      }

      /**
       * Use this function to add a new line SVG path element.
       *
       * @memberof Chartist.Svg.Path
       * @param {Number} x The x coordinate for the line element.
       * @param {Number} y The y coordinate for the line element.
       * @param {Boolean} [relative] If set to true the line element will be created with relative coordinates (lowercase letter)
       * @param {*} [data] Any data that should be stored with the element object that will be accessible in pathElement
       * @return {Chartist.Svg.Path} The current path object for easy call chaining.
       */
      function line(x, y, relative, data) {
        element('L', {
          x: +x,
          y: +y
        }, this.pathElements, this.pos++, relative, data);
        return this;
      }

      /**
       * Use this function to add a new curve SVG path element.
       *
       * @memberof Chartist.Svg.Path
       * @param {Number} x1 The x coordinate for the first control point of the bezier curve.
       * @param {Number} y1 The y coordinate for the first control point of the bezier curve.
       * @param {Number} x2 The x coordinate for the second control point of the bezier curve.
       * @param {Number} y2 The y coordinate for the second control point of the bezier curve.
       * @param {Number} x The x coordinate for the target point of the curve element.
       * @param {Number} y The y coordinate for the target point of the curve element.
       * @param {Boolean} [relative] If set to true the curve element will be created with relative coordinates (lowercase letter)
       * @param {*} [data] Any data that should be stored with the element object that will be accessible in pathElement
       * @return {Chartist.Svg.Path} The current path object for easy call chaining.
       */
      function curve(x1, y1, x2, y2, x, y, relative, data) {
        element('C', {
          x1: +x1,
          y1: +y1,
          x2: +x2,
          y2: +y2,
          x: +x,
          y: +y
        }, this.pathElements, this.pos++, relative, data);
        return this;
      }

      /**
       * Use this function to add a new non-bezier curve SVG path element.
       *
       * @memberof Chartist.Svg.Path
       * @param {Number} rx The radius to be used for the x-axis of the arc.
       * @param {Number} ry The radius to be used for the y-axis of the arc.
       * @param {Number} xAr Defines the orientation of the arc
       * @param {Number} lAf Large arc flag
       * @param {Number} sf Sweep flag
       * @param {Number} x The x coordinate for the target point of the curve element.
       * @param {Number} y The y coordinate for the target point of the curve element.
       * @param {Boolean} [relative] If set to true the curve element will be created with relative coordinates (lowercase letter)
       * @param {*} [data] Any data that should be stored with the element object that will be accessible in pathElement
       * @return {Chartist.Svg.Path} The current path object for easy call chaining.
       */
      function arc(rx, ry, xAr, lAf, sf, x, y, relative, data) {
        element('A', {
          rx: +rx,
          ry: +ry,
          xAr: +xAr,
          lAf: +lAf,
          sf: +sf,
          x: +x,
          y: +y
        }, this.pathElements, this.pos++, relative, data);
        return this;
      }

      /**
       * Parses an SVG path seen in the d attribute of path elements, and inserts the parsed elements into the existing path object at the current cursor position. Any closing path indicators (Z at the end of the path) will be ignored by the parser as this is provided by the close option in the options of the path object.
       *
       * @memberof Chartist.Svg.Path
       * @param {String} path Any SVG path that contains move (m), line (l) or curve (c) components.
       * @return {Chartist.Svg.Path} The current path object for easy call chaining.
       */
      function parse(path) {
        // Parsing the SVG path string into an array of arrays [['M', '10', '10'], ['L', '100', '100']]
        var chunks = path.replace(/([A-Za-z])([0-9])/g, '$1 $2')
          .replace(/([0-9])([A-Za-z])/g, '$1 $2')
          .split(/[\s,]+/)
          .reduce(function(result, element) {
            if(element.match(/[A-Za-z]/)) {
              result.push([]);
            }

            result[result.length - 1].push(element);
            return result;
          }, []);

        // If this is a closed path we remove the Z at the end because this is determined by the close option
        if(chunks[chunks.length - 1][0].toUpperCase() === 'Z') {
          chunks.pop();
        }

        // Using svgPathElementDescriptions to map raw path arrays into objects that contain the command and the parameters
        // For example {command: 'M', x: '10', y: '10'}
        var elements = chunks.map(function(chunk) {
            var command = chunk.shift(),
              description = elementDescriptions[command.toLowerCase()];

            return Chartist.extend({
              command: command
            }, description.reduce(function(result, paramName, index) {
              result[paramName] = +chunk[index];
              return result;
            }, {}));
          });

        // Preparing a splice call with the elements array as var arg params and insert the parsed elements at the current position
        var spliceArgs = [this.pos, 0];
        Array.prototype.push.apply(spliceArgs, elements);
        Array.prototype.splice.apply(this.pathElements, spliceArgs);
        // Increase the internal position by the element count
        this.pos += elements.length;

        return this;
      }

      /**
       * This function renders to current SVG path object into a final SVG string that can be used in the d attribute of SVG path elements. It uses the accuracy option to round big decimals. If the close parameter was set in the constructor of this path object then a path closing Z will be appended to the output string.
       *
       * @memberof Chartist.Svg.Path
       * @return {String}
       */
      function stringify() {
        var accuracyMultiplier = Math.pow(10, this.options.accuracy);

        return this.pathElements.reduce(function(path, pathElement) {
            var params = elementDescriptions[pathElement.command.toLowerCase()].map(function(paramName) {
              return this.options.accuracy ?
                (Math.round(pathElement[paramName] * accuracyMultiplier) / accuracyMultiplier) :
                pathElement[paramName];
            }.bind(this));

            return path + pathElement.command + params.join(',');
          }.bind(this), '') + (this.close ? 'Z' : '');
      }

      /**
       * Scales all elements in the current SVG path object. There is an individual parameter for each coordinate. Scaling will also be done for control points of curves, affecting the given coordinate.
       *
       * @memberof Chartist.Svg.Path
       * @param {Number} x The number which will be used to scale the x, x1 and x2 of all path elements.
       * @param {Number} y The number which will be used to scale the y, y1 and y2 of all path elements.
       * @return {Chartist.Svg.Path} The current path object for easy call chaining.
       */
      function scale(x, y) {
        forEachParam(this.pathElements, function(pathElement, paramName) {
          pathElement[paramName] *= paramName[0] === 'x' ? x : y;
        });
        return this;
      }

      /**
       * Translates all elements in the current SVG path object. The translation is relative and there is an individual parameter for each coordinate. Translation will also be done for control points of curves, affecting the given coordinate.
       *
       * @memberof Chartist.Svg.Path
       * @param {Number} x The number which will be used to translate the x, x1 and x2 of all path elements.
       * @param {Number} y The number which will be used to translate the y, y1 and y2 of all path elements.
       * @return {Chartist.Svg.Path} The current path object for easy call chaining.
       */
      function translate(x, y) {
        forEachParam(this.pathElements, function(pathElement, paramName) {
          pathElement[paramName] += paramName[0] === 'x' ? x : y;
        });
        return this;
      }

      /**
       * This function will run over all existing path elements and then loop over their attributes. The callback function will be called for every path element attribute that exists in the current path.
       * The method signature of the callback function looks like this:
       * ```javascript
       * function(pathElement, paramName, pathElementIndex, paramIndex, pathElements)
       * ```
       * If something else than undefined is returned by the callback function, this value will be used to replace the old value. This allows you to build custom transformations of path objects that can't be achieved using the basic transformation functions scale and translate.
       *
       * @memberof Chartist.Svg.Path
       * @param {Function} transformFnc The callback function for the transformation. Check the signature in the function description.
       * @return {Chartist.Svg.Path} The current path object for easy call chaining.
       */
      function transform(transformFnc) {
        forEachParam(this.pathElements, function(pathElement, paramName, pathElementIndex, paramIndex, pathElements) {
          var transformed = transformFnc(pathElement, paramName, pathElementIndex, paramIndex, pathElements);
          if(transformed || transformed === 0) {
            pathElement[paramName] = transformed;
          }
        });
        return this;
      }

      /**
       * This function clones a whole path object with all its properties. This is a deep clone and path element objects will also be cloned.
       *
       * @memberof Chartist.Svg.Path
       * @param {Boolean} [close] Optional option to set the new cloned path to closed. If not specified or false, the original path close option will be used.
       * @return {Chartist.Svg.Path}
       */
      function clone(close) {
        var c = new Chartist.Svg.Path(close || this.close);
        c.pos = this.pos;
        c.pathElements = this.pathElements.slice().map(function cloneElements(pathElement) {
          return Chartist.extend({}, pathElement);
        });
        c.options = Chartist.extend({}, this.options);
        return c;
      }

      /**
       * Split a Svg.Path object by a specific command in the path chain. The path chain will be split and an array of newly created paths objects will be returned. This is useful if you'd like to split an SVG path by it's move commands, for example, in order to isolate chunks of drawings.
       *
       * @memberof Chartist.Svg.Path
       * @param {String} command The command you'd like to use to split the path
       * @return {Array<Chartist.Svg.Path>}
       */
      function splitByCommand(command) {
        var split = [
          new Chartist.Svg.Path()
        ];

        this.pathElements.forEach(function(pathElement) {
          if(pathElement.command === command.toUpperCase() && split[split.length - 1].pathElements.length !== 0) {
            split.push(new Chartist.Svg.Path());
          }

          split[split.length - 1].pathElements.push(pathElement);
        });

        return split;
      }

      /**
       * This static function on `Chartist.Svg.Path` is joining multiple paths together into one paths.
       *
       * @memberof Chartist.Svg.Path
       * @param {Array<Chartist.Svg.Path>} paths A list of paths to be joined together. The order is important.
       * @param {boolean} close If the newly created path should be a closed path
       * @param {Object} options Path options for the newly created path.
       * @return {Chartist.Svg.Path}
       */

      function join(paths, close, options) {
        var joinedPath = new Chartist.Svg.Path(close, options);
        for(var i = 0; i < paths.length; i++) {
          var path = paths[i];
          for(var j = 0; j < path.pathElements.length; j++) {
            joinedPath.pathElements.push(path.pathElements[j]);
          }
        }
        return joinedPath;
      }

      Chartist.Svg.Path = Chartist.Class.extend({
        constructor: SvgPath,
        position: position,
        remove: remove,
        move: move,
        line: line,
        curve: curve,
        arc: arc,
        scale: scale,
        translate: translate,
        transform: transform,
        parse: parse,
        stringify: stringify,
        clone: clone,
        splitByCommand: splitByCommand
      });

      Chartist.Svg.Path.elementDescriptions = elementDescriptions;
      Chartist.Svg.Path.join = join;
    }(this || commonjsGlobal, Chartist));
    (function (globalRoot, Chartist) {

      globalRoot.window;
      globalRoot.document;

      var axisUnits = {
        x: {
          pos: 'x',
          len: 'width',
          dir: 'horizontal',
          rectStart: 'x1',
          rectEnd: 'x2',
          rectOffset: 'y2'
        },
        y: {
          pos: 'y',
          len: 'height',
          dir: 'vertical',
          rectStart: 'y2',
          rectEnd: 'y1',
          rectOffset: 'x1'
        }
      };

      function Axis(units, chartRect, ticks, options) {
        this.units = units;
        this.counterUnits = units === axisUnits.x ? axisUnits.y : axisUnits.x;
        this.chartRect = chartRect;
        this.axisLength = chartRect[units.rectEnd] - chartRect[units.rectStart];
        this.gridOffset = chartRect[units.rectOffset];
        this.ticks = ticks;
        this.options = options;
      }

      function createGridAndLabels(gridGroup, labelGroup, useForeignObject, chartOptions, eventEmitter) {
        var axisOptions = chartOptions['axis' + this.units.pos.toUpperCase()];
        var projectedValues = this.ticks.map(this.projectValue.bind(this));
        var labelValues = this.ticks.map(axisOptions.labelInterpolationFnc);

        projectedValues.forEach(function(projectedValue, index) {
          var labelOffset = {
            x: 0,
            y: 0
          };

          // TODO: Find better solution for solving this problem
          // Calculate how much space we have available for the label
          var labelLength;
          if(projectedValues[index + 1]) {
            // If we still have one label ahead, we can calculate the distance to the next tick / label
            labelLength = projectedValues[index + 1] - projectedValue;
          } else {
            // If we don't have a label ahead and we have only two labels in total, we just take the remaining distance to
            // on the whole axis length. We limit that to a minimum of 30 pixel, so that labels close to the border will
            // still be visible inside of the chart padding.
            labelLength = Math.max(this.axisLength - projectedValue, 30);
          }

          // Skip grid lines and labels where interpolated label values are falsey (execpt for 0)
          if(Chartist.isFalseyButZero(labelValues[index]) && labelValues[index] !== '') {
            return;
          }

          // Transform to global coordinates using the chartRect
          // We also need to set the label offset for the createLabel function
          if(this.units.pos === 'x') {
            projectedValue = this.chartRect.x1 + projectedValue;
            labelOffset.x = chartOptions.axisX.labelOffset.x;

            // If the labels should be positioned in start position (top side for vertical axis) we need to set a
            // different offset as for positioned with end (bottom)
            if(chartOptions.axisX.position === 'start') {
              labelOffset.y = this.chartRect.padding.top + chartOptions.axisX.labelOffset.y + (useForeignObject ? 5 : 20);
            } else {
              labelOffset.y = this.chartRect.y1 + chartOptions.axisX.labelOffset.y + (useForeignObject ? 5 : 20);
            }
          } else {
            projectedValue = this.chartRect.y1 - projectedValue;
            labelOffset.y = chartOptions.axisY.labelOffset.y - (useForeignObject ? labelLength : 0);

            // If the labels should be positioned in start position (left side for horizontal axis) we need to set a
            // different offset as for positioned with end (right side)
            if(chartOptions.axisY.position === 'start') {
              labelOffset.x = useForeignObject ? this.chartRect.padding.left + chartOptions.axisY.labelOffset.x : this.chartRect.x1 - 10;
            } else {
              labelOffset.x = this.chartRect.x2 + chartOptions.axisY.labelOffset.x + 10;
            }
          }

          if(axisOptions.showGrid) {
            Chartist.createGrid(projectedValue, index, this, this.gridOffset, this.chartRect[this.counterUnits.len](), gridGroup, [
              chartOptions.classNames.grid,
              chartOptions.classNames[this.units.dir]
            ], eventEmitter);
          }

          if(axisOptions.showLabel) {
            Chartist.createLabel(projectedValue, labelLength, index, labelValues, this, axisOptions.offset, labelOffset, labelGroup, [
              chartOptions.classNames.label,
              chartOptions.classNames[this.units.dir],
              (axisOptions.position === 'start' ? chartOptions.classNames[axisOptions.position] : chartOptions.classNames['end'])
            ], useForeignObject, eventEmitter);
          }
        }.bind(this));
      }

      Chartist.Axis = Chartist.Class.extend({
        constructor: Axis,
        createGridAndLabels: createGridAndLabels,
        projectValue: function(value, index, data) {
          throw new Error('Base axis can\'t be instantiated!');
        }
      });

      Chartist.Axis.units = axisUnits;

    }(this || commonjsGlobal, Chartist));
    /* global Chartist */
    (function (globalRoot, Chartist) {

      globalRoot.window;
      globalRoot.document;

      function AutoScaleAxis(axisUnit, data, chartRect, options) {
        // Usually we calculate highLow based on the data but this can be overriden by a highLow object in the options
        var highLow = options.highLow || Chartist.getHighLow(data, options, axisUnit.pos);
        this.bounds = Chartist.getBounds(chartRect[axisUnit.rectEnd] - chartRect[axisUnit.rectStart], highLow, options.scaleMinSpace || 20, options.onlyInteger);
        this.range = {
          min: this.bounds.min,
          max: this.bounds.max
        };

        Chartist.AutoScaleAxis.super.constructor.call(this,
          axisUnit,
          chartRect,
          this.bounds.values,
          options);
      }

      function projectValue(value) {
        return this.axisLength * (+Chartist.getMultiValue(value, this.units.pos) - this.bounds.min) / this.bounds.range;
      }

      Chartist.AutoScaleAxis = Chartist.Axis.extend({
        constructor: AutoScaleAxis,
        projectValue: projectValue
      });

    }(this || commonjsGlobal, Chartist));
    /* global Chartist */
    (function (globalRoot, Chartist) {

      globalRoot.window;
      globalRoot.document;

      function FixedScaleAxis(axisUnit, data, chartRect, options) {
        var highLow = options.highLow || Chartist.getHighLow(data, options, axisUnit.pos);
        this.divisor = options.divisor || 1;
        this.ticks = options.ticks || Chartist.times(this.divisor).map(function(value, index) {
          return highLow.low + (highLow.high - highLow.low) / this.divisor * index;
        }.bind(this));
        this.ticks.sort(function(a, b) {
          return a - b;
        });
        this.range = {
          min: highLow.low,
          max: highLow.high
        };

        Chartist.FixedScaleAxis.super.constructor.call(this,
          axisUnit,
          chartRect,
          this.ticks,
          options);

        this.stepLength = this.axisLength / this.divisor;
      }

      function projectValue(value) {
        return this.axisLength * (+Chartist.getMultiValue(value, this.units.pos) - this.range.min) / (this.range.max - this.range.min);
      }

      Chartist.FixedScaleAxis = Chartist.Axis.extend({
        constructor: FixedScaleAxis,
        projectValue: projectValue
      });

    }(this || commonjsGlobal, Chartist));
    /* global Chartist */
    (function (globalRoot, Chartist) {

      globalRoot.window;
      globalRoot.document;

      function StepAxis(axisUnit, data, chartRect, options) {
        Chartist.StepAxis.super.constructor.call(this,
          axisUnit,
          chartRect,
          options.ticks,
          options);

        var calc = Math.max(1, options.ticks.length - (options.stretch ? 1 : 0));
        this.stepLength = this.axisLength / calc;
      }

      function projectValue(value, index) {
        return this.stepLength * index;
      }

      Chartist.StepAxis = Chartist.Axis.extend({
        constructor: StepAxis,
        projectValue: projectValue
      });

    }(this || commonjsGlobal, Chartist));
    /* global Chartist */
    (function(globalRoot, Chartist){

      globalRoot.window;
      globalRoot.document;

      /**
       * Default options in line charts. Expand the code view to see a detailed list of options with comments.
       *
       * @memberof Chartist.Line
       */
      var defaultOptions = {
        // Options for X-Axis
        axisX: {
          // The offset of the labels to the chart area
          offset: 30,
          // Position where labels are placed. Can be set to `start` or `end` where `start` is equivalent to left or top on vertical axis and `end` is equivalent to right or bottom on horizontal axis.
          position: 'end',
          // Allows you to correct label positioning on this axis by positive or negative x and y offset.
          labelOffset: {
            x: 0,
            y: 0
          },
          // If labels should be shown or not
          showLabel: true,
          // If the axis grid should be drawn or not
          showGrid: true,
          // Interpolation function that allows you to intercept the value from the axis label
          labelInterpolationFnc: Chartist.noop,
          // Set the axis type to be used to project values on this axis. If not defined, Chartist.StepAxis will be used for the X-Axis, where the ticks option will be set to the labels in the data and the stretch option will be set to the global fullWidth option. This type can be changed to any axis constructor available (e.g. Chartist.FixedScaleAxis), where all axis options should be present here.
          type: undefined
        },
        // Options for Y-Axis
        axisY: {
          // The offset of the labels to the chart area
          offset: 40,
          // Position where labels are placed. Can be set to `start` or `end` where `start` is equivalent to left or top on vertical axis and `end` is equivalent to right or bottom on horizontal axis.
          position: 'start',
          // Allows you to correct label positioning on this axis by positive or negative x and y offset.
          labelOffset: {
            x: 0,
            y: 0
          },
          // If labels should be shown or not
          showLabel: true,
          // If the axis grid should be drawn or not
          showGrid: true,
          // Interpolation function that allows you to intercept the value from the axis label
          labelInterpolationFnc: Chartist.noop,
          // Set the axis type to be used to project values on this axis. If not defined, Chartist.AutoScaleAxis will be used for the Y-Axis, where the high and low options will be set to the global high and low options. This type can be changed to any axis constructor available (e.g. Chartist.FixedScaleAxis), where all axis options should be present here.
          type: undefined,
          // This value specifies the minimum height in pixel of the scale steps
          scaleMinSpace: 20,
          // Use only integer values (whole numbers) for the scale steps
          onlyInteger: false
        },
        // Specify a fixed width for the chart as a string (i.e. '100px' or '50%')
        width: undefined,
        // Specify a fixed height for the chart as a string (i.e. '100px' or '50%')
        height: undefined,
        // If the line should be drawn or not
        showLine: true,
        // If dots should be drawn or not
        showPoint: true,
        // If the line chart should draw an area
        showArea: false,
        // The base for the area chart that will be used to close the area shape (is normally 0)
        areaBase: 0,
        // Specify if the lines should be smoothed. This value can be true or false where true will result in smoothing using the default smoothing interpolation function Chartist.Interpolation.cardinal and false results in Chartist.Interpolation.none. You can also choose other smoothing / interpolation functions available in the Chartist.Interpolation module, or write your own interpolation function. Check the examples for a brief description.
        lineSmooth: true,
        // If the line chart should add a background fill to the .ct-grids group.
        showGridBackground: false,
        // Overriding the natural low of the chart allows you to zoom in or limit the charts lowest displayed value
        low: undefined,
        // Overriding the natural high of the chart allows you to zoom in or limit the charts highest displayed value
        high: undefined,
        // Padding of the chart drawing area to the container element and labels as a number or padding object {top: 5, right: 5, bottom: 5, left: 5}
        chartPadding: {
          top: 15,
          right: 15,
          bottom: 5,
          left: 10
        },
        // When set to true, the last grid line on the x-axis is not drawn and the chart elements will expand to the full available width of the chart. For the last label to be drawn correctly you might need to add chart padding or offset the last label with a draw event handler.
        fullWidth: false,
        // If true the whole data is reversed including labels, the series order as well as the whole series data arrays.
        reverseData: false,
        // Override the class names that get used to generate the SVG structure of the chart
        classNames: {
          chart: 'ct-chart-line',
          label: 'ct-label',
          labelGroup: 'ct-labels',
          series: 'ct-series',
          line: 'ct-line',
          point: 'ct-point',
          area: 'ct-area',
          grid: 'ct-grid',
          gridGroup: 'ct-grids',
          gridBackground: 'ct-grid-background',
          vertical: 'ct-vertical',
          horizontal: 'ct-horizontal',
          start: 'ct-start',
          end: 'ct-end'
        }
      };

      /**
       * Creates a new chart
       *
       */
      function createChart(options) {
        var data = Chartist.normalizeData(this.data, options.reverseData, true);

        // Create new svg object
        this.svg = Chartist.createSvg(this.container, options.width, options.height, options.classNames.chart);
        // Create groups for labels, grid and series
        var gridGroup = this.svg.elem('g').addClass(options.classNames.gridGroup);
        var seriesGroup = this.svg.elem('g');
        var labelGroup = this.svg.elem('g').addClass(options.classNames.labelGroup);

        var chartRect = Chartist.createChartRect(this.svg, options, defaultOptions.padding);
        var axisX, axisY;

        if(options.axisX.type === undefined) {
          axisX = new Chartist.StepAxis(Chartist.Axis.units.x, data.normalized.series, chartRect, Chartist.extend({}, options.axisX, {
            ticks: data.normalized.labels,
            stretch: options.fullWidth
          }));
        } else {
          axisX = options.axisX.type.call(Chartist, Chartist.Axis.units.x, data.normalized.series, chartRect, options.axisX);
        }

        if(options.axisY.type === undefined) {
          axisY = new Chartist.AutoScaleAxis(Chartist.Axis.units.y, data.normalized.series, chartRect, Chartist.extend({}, options.axisY, {
            high: Chartist.isNumeric(options.high) ? options.high : options.axisY.high,
            low: Chartist.isNumeric(options.low) ? options.low : options.axisY.low
          }));
        } else {
          axisY = options.axisY.type.call(Chartist, Chartist.Axis.units.y, data.normalized.series, chartRect, options.axisY);
        }

        axisX.createGridAndLabels(gridGroup, labelGroup, this.supportsForeignObject, options, this.eventEmitter);
        axisY.createGridAndLabels(gridGroup, labelGroup, this.supportsForeignObject, options, this.eventEmitter);

        if (options.showGridBackground) {
          Chartist.createGridBackground(gridGroup, chartRect, options.classNames.gridBackground, this.eventEmitter);
        }

        // Draw the series
        data.raw.series.forEach(function(series, seriesIndex) {
          var seriesElement = seriesGroup.elem('g');

          // Write attributes to series group element. If series name or meta is undefined the attributes will not be written
          seriesElement.attr({
            'ct:series-name': series.name,
            'ct:meta': Chartist.serialize(series.meta)
          });

          // Use series class from series data or if not set generate one
          seriesElement.addClass([
            options.classNames.series,
            (series.className || options.classNames.series + '-' + Chartist.alphaNumerate(seriesIndex))
          ].join(' '));

          var pathCoordinates = [],
            pathData = [];

          data.normalized.series[seriesIndex].forEach(function(value, valueIndex) {
            var p = {
              x: chartRect.x1 + axisX.projectValue(value, valueIndex, data.normalized.series[seriesIndex]),
              y: chartRect.y1 - axisY.projectValue(value, valueIndex, data.normalized.series[seriesIndex])
            };
            pathCoordinates.push(p.x, p.y);
            pathData.push({
              value: value,
              valueIndex: valueIndex,
              meta: Chartist.getMetaData(series, valueIndex)
            });
          }.bind(this));

          var seriesOptions = {
            lineSmooth: Chartist.getSeriesOption(series, options, 'lineSmooth'),
            showPoint: Chartist.getSeriesOption(series, options, 'showPoint'),
            showLine: Chartist.getSeriesOption(series, options, 'showLine'),
            showArea: Chartist.getSeriesOption(series, options, 'showArea'),
            areaBase: Chartist.getSeriesOption(series, options, 'areaBase')
          };

          var smoothing = typeof seriesOptions.lineSmooth === 'function' ?
            seriesOptions.lineSmooth : (seriesOptions.lineSmooth ? Chartist.Interpolation.monotoneCubic() : Chartist.Interpolation.none());
          // Interpolating path where pathData will be used to annotate each path element so we can trace back the original
          // index, value and meta data
          var path = smoothing(pathCoordinates, pathData);

          // If we should show points we need to create them now to avoid secondary loop
          // Points are drawn from the pathElements returned by the interpolation function
          // Small offset for Firefox to render squares correctly
          if (seriesOptions.showPoint) {

            path.pathElements.forEach(function(pathElement) {
              var point = seriesElement.elem('line', {
                x1: pathElement.x,
                y1: pathElement.y,
                x2: pathElement.x + 0.01,
                y2: pathElement.y
              }, options.classNames.point).attr({
                'ct:value': [pathElement.data.value.x, pathElement.data.value.y].filter(Chartist.isNumeric).join(','),
                'ct:meta': Chartist.serialize(pathElement.data.meta)
              });

              this.eventEmitter.emit('draw', {
                type: 'point',
                value: pathElement.data.value,
                index: pathElement.data.valueIndex,
                meta: pathElement.data.meta,
                series: series,
                seriesIndex: seriesIndex,
                axisX: axisX,
                axisY: axisY,
                group: seriesElement,
                element: point,
                x: pathElement.x,
                y: pathElement.y
              });
            }.bind(this));
          }

          if(seriesOptions.showLine) {
            var line = seriesElement.elem('path', {
              d: path.stringify()
            }, options.classNames.line, true);

            this.eventEmitter.emit('draw', {
              type: 'line',
              values: data.normalized.series[seriesIndex],
              path: path.clone(),
              chartRect: chartRect,
              index: seriesIndex,
              series: series,
              seriesIndex: seriesIndex,
              seriesMeta: series.meta,
              axisX: axisX,
              axisY: axisY,
              group: seriesElement,
              element: line
            });
          }

          // Area currently only works with axes that support a range!
          if(seriesOptions.showArea && axisY.range) {
            // If areaBase is outside the chart area (< min or > max) we need to set it respectively so that
            // the area is not drawn outside the chart area.
            var areaBase = Math.max(Math.min(seriesOptions.areaBase, axisY.range.max), axisY.range.min);

            // We project the areaBase value into screen coordinates
            var areaBaseProjected = chartRect.y1 - axisY.projectValue(areaBase);

            // In order to form the area we'll first split the path by move commands so we can chunk it up into segments
            path.splitByCommand('M').filter(function onlySolidSegments(pathSegment) {
              // We filter only "solid" segments that contain more than one point. Otherwise there's no need for an area
              return pathSegment.pathElements.length > 1;
            }).map(function convertToArea(solidPathSegments) {
              // Receiving the filtered solid path segments we can now convert those segments into fill areas
              var firstElement = solidPathSegments.pathElements[0];
              var lastElement = solidPathSegments.pathElements[solidPathSegments.pathElements.length - 1];

              // Cloning the solid path segment with closing option and removing the first move command from the clone
              // We then insert a new move that should start at the area base and draw a straight line up or down
              // at the end of the path we add an additional straight line to the projected area base value
              // As the closing option is set our path will be automatically closed
              return solidPathSegments.clone(true)
                .position(0)
                .remove(1)
                .move(firstElement.x, areaBaseProjected)
                .line(firstElement.x, firstElement.y)
                .position(solidPathSegments.pathElements.length + 1)
                .line(lastElement.x, areaBaseProjected);

            }).forEach(function createArea(areaPath) {
              // For each of our newly created area paths, we'll now create path elements by stringifying our path objects
              // and adding the created DOM elements to the correct series group
              var area = seriesElement.elem('path', {
                d: areaPath.stringify()
              }, options.classNames.area, true);

              // Emit an event for each area that was drawn
              this.eventEmitter.emit('draw', {
                type: 'area',
                values: data.normalized.series[seriesIndex],
                path: areaPath.clone(),
                series: series,
                seriesIndex: seriesIndex,
                axisX: axisX,
                axisY: axisY,
                chartRect: chartRect,
                index: seriesIndex,
                group: seriesElement,
                element: area
              });
            }.bind(this));
          }
        }.bind(this));

        this.eventEmitter.emit('created', {
          bounds: axisY.bounds,
          chartRect: chartRect,
          axisX: axisX,
          axisY: axisY,
          svg: this.svg,
          options: options
        });
      }

      /**
       * This method creates a new line chart.
       *
       * @memberof Chartist.Line
       * @param {String|Node} query A selector query string or directly a DOM element
       * @param {Object} data The data object that needs to consist of a labels and a series array
       * @param {Object} [options] The options object with options that override the default options. Check the examples for a detailed list.
       * @param {Array} [responsiveOptions] Specify an array of responsive option arrays which are a media query and options object pair => [[mediaQueryString, optionsObject],[more...]]
       * @return {Object} An object which exposes the API for the created chart
       *
       * @example
       * // Create a simple line chart
       * var data = {
       *   // A labels array that can contain any sort of values
       *   labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
       *   // Our series array that contains series objects or in this case series data arrays
       *   series: [
       *     [5, 2, 4, 2, 0]
       *   ]
       * };
       *
       * // As options we currently only set a static size of 300x200 px
       * var options = {
       *   width: '300px',
       *   height: '200px'
       * };
       *
       * // In the global name space Chartist we call the Line function to initialize a line chart. As a first parameter we pass in a selector where we would like to get our chart created. Second parameter is the actual data object and as a third parameter we pass in our options
       * new Chartist.Line('.ct-chart', data, options);
       *
       * @example
       * // Use specific interpolation function with configuration from the Chartist.Interpolation module
       *
       * var chart = new Chartist.Line('.ct-chart', {
       *   labels: [1, 2, 3, 4, 5],
       *   series: [
       *     [1, 1, 8, 1, 7]
       *   ]
       * }, {
       *   lineSmooth: Chartist.Interpolation.cardinal({
       *     tension: 0.2
       *   })
       * });
       *
       * @example
       * // Create a line chart with responsive options
       *
       * var data = {
       *   // A labels array that can contain any sort of values
       *   labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
       *   // Our series array that contains series objects or in this case series data arrays
       *   series: [
       *     [5, 2, 4, 2, 0]
       *   ]
       * };
       *
       * // In addition to the regular options we specify responsive option overrides that will override the default configutation based on the matching media queries.
       * var responsiveOptions = [
       *   ['screen and (min-width: 641px) and (max-width: 1024px)', {
       *     showPoint: false,
       *     axisX: {
       *       labelInterpolationFnc: function(value) {
       *         // Will return Mon, Tue, Wed etc. on medium screens
       *         return value.slice(0, 3);
       *       }
       *     }
       *   }],
       *   ['screen and (max-width: 640px)', {
       *     showLine: false,
       *     axisX: {
       *       labelInterpolationFnc: function(value) {
       *         // Will return M, T, W etc. on small screens
       *         return value[0];
       *       }
       *     }
       *   }]
       * ];
       *
       * new Chartist.Line('.ct-chart', data, null, responsiveOptions);
       *
       */
      function Line(query, data, options, responsiveOptions) {
        Chartist.Line.super.constructor.call(this,
          query,
          data,
          defaultOptions,
          Chartist.extend({}, defaultOptions, options),
          responsiveOptions);
      }

      // Creating line chart type in Chartist namespace
      Chartist.Line = Chartist.Base.extend({
        constructor: Line,
        createChart: createChart
      });

    }(this || commonjsGlobal, Chartist));
    /* global Chartist */
    (function(globalRoot, Chartist){

      globalRoot.window;
      globalRoot.document;

      /**
       * Default options in bar charts. Expand the code view to see a detailed list of options with comments.
       *
       * @memberof Chartist.Bar
       */
      var defaultOptions = {
        // Options for X-Axis
        axisX: {
          // The offset of the chart drawing area to the border of the container
          offset: 30,
          // Position where labels are placed. Can be set to `start` or `end` where `start` is equivalent to left or top on vertical axis and `end` is equivalent to right or bottom on horizontal axis.
          position: 'end',
          // Allows you to correct label positioning on this axis by positive or negative x and y offset.
          labelOffset: {
            x: 0,
            y: 0
          },
          // If labels should be shown or not
          showLabel: true,
          // If the axis grid should be drawn or not
          showGrid: true,
          // Interpolation function that allows you to intercept the value from the axis label
          labelInterpolationFnc: Chartist.noop,
          // This value specifies the minimum width in pixel of the scale steps
          scaleMinSpace: 30,
          // Use only integer values (whole numbers) for the scale steps
          onlyInteger: false
        },
        // Options for Y-Axis
        axisY: {
          // The offset of the chart drawing area to the border of the container
          offset: 40,
          // Position where labels are placed. Can be set to `start` or `end` where `start` is equivalent to left or top on vertical axis and `end` is equivalent to right or bottom on horizontal axis.
          position: 'start',
          // Allows you to correct label positioning on this axis by positive or negative x and y offset.
          labelOffset: {
            x: 0,
            y: 0
          },
          // If labels should be shown or not
          showLabel: true,
          // If the axis grid should be drawn or not
          showGrid: true,
          // Interpolation function that allows you to intercept the value from the axis label
          labelInterpolationFnc: Chartist.noop,
          // This value specifies the minimum height in pixel of the scale steps
          scaleMinSpace: 20,
          // Use only integer values (whole numbers) for the scale steps
          onlyInteger: false
        },
        // Specify a fixed width for the chart as a string (i.e. '100px' or '50%')
        width: undefined,
        // Specify a fixed height for the chart as a string (i.e. '100px' or '50%')
        height: undefined,
        // Overriding the natural high of the chart allows you to zoom in or limit the charts highest displayed value
        high: undefined,
        // Overriding the natural low of the chart allows you to zoom in or limit the charts lowest displayed value
        low: undefined,
        // Unless low/high are explicitly set, bar chart will be centered at zero by default. Set referenceValue to null to auto scale.
        referenceValue: 0,
        // Padding of the chart drawing area to the container element and labels as a number or padding object {top: 5, right: 5, bottom: 5, left: 5}
        chartPadding: {
          top: 15,
          right: 15,
          bottom: 5,
          left: 10
        },
        // Specify the distance in pixel of bars in a group
        seriesBarDistance: 15,
        // If set to true this property will cause the series bars to be stacked. Check the `stackMode` option for further stacking options.
        stackBars: false,
        // If set to 'overlap' this property will force the stacked bars to draw from the zero line.
        // If set to 'accumulate' this property will form a total for each series point. This will also influence the y-axis and the overall bounds of the chart. In stacked mode the seriesBarDistance property will have no effect.
        stackMode: 'accumulate',
        // Inverts the axes of the bar chart in order to draw a horizontal bar chart. Be aware that you also need to invert your axis settings as the Y Axis will now display the labels and the X Axis the values.
        horizontalBars: false,
        // If set to true then each bar will represent a series and the data array is expected to be a one dimensional array of data values rather than a series array of series. This is useful if the bar chart should represent a profile rather than some data over time.
        distributeSeries: false,
        // If true the whole data is reversed including labels, the series order as well as the whole series data arrays.
        reverseData: false,
        // If the bar chart should add a background fill to the .ct-grids group.
        showGridBackground: false,
        // Override the class names that get used to generate the SVG structure of the chart
        classNames: {
          chart: 'ct-chart-bar',
          horizontalBars: 'ct-horizontal-bars',
          label: 'ct-label',
          labelGroup: 'ct-labels',
          series: 'ct-series',
          bar: 'ct-bar',
          grid: 'ct-grid',
          gridGroup: 'ct-grids',
          gridBackground: 'ct-grid-background',
          vertical: 'ct-vertical',
          horizontal: 'ct-horizontal',
          start: 'ct-start',
          end: 'ct-end'
        }
      };

      /**
       * Creates a new chart
       *
       */
      function createChart(options) {
        var data;
        var highLow;

        if(options.distributeSeries) {
          data = Chartist.normalizeData(this.data, options.reverseData, options.horizontalBars ? 'x' : 'y');
          data.normalized.series = data.normalized.series.map(function(value) {
            return [value];
          });
        } else {
          data = Chartist.normalizeData(this.data, options.reverseData, options.horizontalBars ? 'x' : 'y');
        }

        // Create new svg element
        this.svg = Chartist.createSvg(
          this.container,
          options.width,
          options.height,
          options.classNames.chart + (options.horizontalBars ? ' ' + options.classNames.horizontalBars : '')
        );

        // Drawing groups in correct order
        var gridGroup = this.svg.elem('g').addClass(options.classNames.gridGroup);
        var seriesGroup = this.svg.elem('g');
        var labelGroup = this.svg.elem('g').addClass(options.classNames.labelGroup);

        if(options.stackBars && data.normalized.series.length !== 0) {

          // If stacked bars we need to calculate the high low from stacked values from each series
          var serialSums = Chartist.serialMap(data.normalized.series, function serialSums() {
            return Array.prototype.slice.call(arguments).map(function(value) {
              return value;
            }).reduce(function(prev, curr) {
              return {
                x: prev.x + (curr && curr.x) || 0,
                y: prev.y + (curr && curr.y) || 0
              };
            }, {x: 0, y: 0});
          });

          highLow = Chartist.getHighLow([serialSums], options, options.horizontalBars ? 'x' : 'y');

        } else {

          highLow = Chartist.getHighLow(data.normalized.series, options, options.horizontalBars ? 'x' : 'y');
        }

        // Overrides of high / low from settings
        highLow.high = +options.high || (options.high === 0 ? 0 : highLow.high);
        highLow.low = +options.low || (options.low === 0 ? 0 : highLow.low);

        var chartRect = Chartist.createChartRect(this.svg, options, defaultOptions.padding);

        var valueAxis,
          labelAxisTicks,
          labelAxis,
          axisX,
          axisY;

        // We need to set step count based on some options combinations
        if(options.distributeSeries && options.stackBars) {
          // If distributed series are enabled and bars need to be stacked, we'll only have one bar and therefore should
          // use only the first label for the step axis
          labelAxisTicks = data.normalized.labels.slice(0, 1);
        } else {
          // If distributed series are enabled but stacked bars aren't, we should use the series labels
          // If we are drawing a regular bar chart with two dimensional series data, we just use the labels array
          // as the bars are normalized
          labelAxisTicks = data.normalized.labels;
        }

        // Set labelAxis and valueAxis based on the horizontalBars setting. This setting will flip the axes if necessary.
        if(options.horizontalBars) {
          if(options.axisX.type === undefined) {
            valueAxis = axisX = new Chartist.AutoScaleAxis(Chartist.Axis.units.x, data.normalized.series, chartRect, Chartist.extend({}, options.axisX, {
              highLow: highLow,
              referenceValue: 0
            }));
          } else {
            valueAxis = axisX = options.axisX.type.call(Chartist, Chartist.Axis.units.x, data.normalized.series, chartRect, Chartist.extend({}, options.axisX, {
              highLow: highLow,
              referenceValue: 0
            }));
          }

          if(options.axisY.type === undefined) {
            labelAxis = axisY = new Chartist.StepAxis(Chartist.Axis.units.y, data.normalized.series, chartRect, {
              ticks: labelAxisTicks
            });
          } else {
            labelAxis = axisY = options.axisY.type.call(Chartist, Chartist.Axis.units.y, data.normalized.series, chartRect, options.axisY);
          }
        } else {
          if(options.axisX.type === undefined) {
            labelAxis = axisX = new Chartist.StepAxis(Chartist.Axis.units.x, data.normalized.series, chartRect, {
              ticks: labelAxisTicks
            });
          } else {
            labelAxis = axisX = options.axisX.type.call(Chartist, Chartist.Axis.units.x, data.normalized.series, chartRect, options.axisX);
          }

          if(options.axisY.type === undefined) {
            valueAxis = axisY = new Chartist.AutoScaleAxis(Chartist.Axis.units.y, data.normalized.series, chartRect, Chartist.extend({}, options.axisY, {
              highLow: highLow,
              referenceValue: 0
            }));
          } else {
            valueAxis = axisY = options.axisY.type.call(Chartist, Chartist.Axis.units.y, data.normalized.series, chartRect, Chartist.extend({}, options.axisY, {
              highLow: highLow,
              referenceValue: 0
            }));
          }
        }

        // Projected 0 point
        var zeroPoint = options.horizontalBars ? (chartRect.x1 + valueAxis.projectValue(0)) : (chartRect.y1 - valueAxis.projectValue(0));
        // Used to track the screen coordinates of stacked bars
        var stackedBarValues = [];

        labelAxis.createGridAndLabels(gridGroup, labelGroup, this.supportsForeignObject, options, this.eventEmitter);
        valueAxis.createGridAndLabels(gridGroup, labelGroup, this.supportsForeignObject, options, this.eventEmitter);

        if (options.showGridBackground) {
          Chartist.createGridBackground(gridGroup, chartRect, options.classNames.gridBackground, this.eventEmitter);
        }

        // Draw the series
        data.raw.series.forEach(function(series, seriesIndex) {
          // Calculating bi-polar value of index for seriesOffset. For i = 0..4 biPol will be -1.5, -0.5, 0.5, 1.5 etc.
          var biPol = seriesIndex - (data.raw.series.length - 1) / 2;
          // Half of the period width between vertical grid lines used to position bars
          var periodHalfLength;
          // Current series SVG element
          var seriesElement;

          // We need to set periodHalfLength based on some options combinations
          if(options.distributeSeries && !options.stackBars) {
            // If distributed series are enabled but stacked bars aren't, we need to use the length of the normaizedData array
            // which is the series count and divide by 2
            periodHalfLength = labelAxis.axisLength / data.normalized.series.length / 2;
          } else if(options.distributeSeries && options.stackBars) {
            // If distributed series and stacked bars are enabled we'll only get one bar so we should just divide the axis
            // length by 2
            periodHalfLength = labelAxis.axisLength / 2;
          } else {
            // On regular bar charts we should just use the series length
            periodHalfLength = labelAxis.axisLength / data.normalized.series[seriesIndex].length / 2;
          }

          // Adding the series group to the series element
          seriesElement = seriesGroup.elem('g');

          // Write attributes to series group element. If series name or meta is undefined the attributes will not be written
          seriesElement.attr({
            'ct:series-name': series.name,
            'ct:meta': Chartist.serialize(series.meta)
          });

          // Use series class from series data or if not set generate one
          seriesElement.addClass([
            options.classNames.series,
            (series.className || options.classNames.series + '-' + Chartist.alphaNumerate(seriesIndex))
          ].join(' '));

          data.normalized.series[seriesIndex].forEach(function(value, valueIndex) {
            var projected,
              bar,
              previousStack,
              labelAxisValueIndex;

            // We need to set labelAxisValueIndex based on some options combinations
            if(options.distributeSeries && !options.stackBars) {
              // If distributed series are enabled but stacked bars aren't, we can use the seriesIndex for later projection
              // on the step axis for label positioning
              labelAxisValueIndex = seriesIndex;
            } else if(options.distributeSeries && options.stackBars) {
              // If distributed series and stacked bars are enabled, we will only get one bar and therefore always use
              // 0 for projection on the label step axis
              labelAxisValueIndex = 0;
            } else {
              // On regular bar charts we just use the value index to project on the label step axis
              labelAxisValueIndex = valueIndex;
            }

            // We need to transform coordinates differently based on the chart layout
            if(options.horizontalBars) {
              projected = {
                x: chartRect.x1 + valueAxis.projectValue(value && value.x ? value.x : 0, valueIndex, data.normalized.series[seriesIndex]),
                y: chartRect.y1 - labelAxis.projectValue(value && value.y ? value.y : 0, labelAxisValueIndex, data.normalized.series[seriesIndex])
              };
            } else {
              projected = {
                x: chartRect.x1 + labelAxis.projectValue(value && value.x ? value.x : 0, labelAxisValueIndex, data.normalized.series[seriesIndex]),
                y: chartRect.y1 - valueAxis.projectValue(value && value.y ? value.y : 0, valueIndex, data.normalized.series[seriesIndex])
              };
            }

            // If the label axis is a step based axis we will offset the bar into the middle of between two steps using
            // the periodHalfLength value. Also we do arrange the different series so that they align up to each other using
            // the seriesBarDistance. If we don't have a step axis, the bar positions can be chosen freely so we should not
            // add any automated positioning.
            if(labelAxis instanceof Chartist.StepAxis) {
              // Offset to center bar between grid lines, but only if the step axis is not stretched
              if(!labelAxis.options.stretch) {
                projected[labelAxis.units.pos] += periodHalfLength * (options.horizontalBars ? -1 : 1);
              }
              // Using bi-polar offset for multiple series if no stacked bars or series distribution is used
              projected[labelAxis.units.pos] += (options.stackBars || options.distributeSeries) ? 0 : biPol * options.seriesBarDistance * (options.horizontalBars ? -1 : 1);
            }

            // Enter value in stacked bar values used to remember previous screen value for stacking up bars
            previousStack = stackedBarValues[valueIndex] || zeroPoint;
            stackedBarValues[valueIndex] = previousStack - (zeroPoint - projected[labelAxis.counterUnits.pos]);

            // Skip if value is undefined
            if(value === undefined) {
              return;
            }

            var positions = {};
            positions[labelAxis.units.pos + '1'] = projected[labelAxis.units.pos];
            positions[labelAxis.units.pos + '2'] = projected[labelAxis.units.pos];

            if(options.stackBars && (options.stackMode === 'accumulate' || !options.stackMode)) {
              // Stack mode: accumulate (default)
              // If bars are stacked we use the stackedBarValues reference and otherwise base all bars off the zero line
              // We want backwards compatibility, so the expected fallback without the 'stackMode' option
              // to be the original behaviour (accumulate)
              positions[labelAxis.counterUnits.pos + '1'] = previousStack;
              positions[labelAxis.counterUnits.pos + '2'] = stackedBarValues[valueIndex];
            } else {
              // Draw from the zero line normally
              // This is also the same code for Stack mode: overlap
              positions[labelAxis.counterUnits.pos + '1'] = zeroPoint;
              positions[labelAxis.counterUnits.pos + '2'] = projected[labelAxis.counterUnits.pos];
            }

            // Limit x and y so that they are within the chart rect
            positions.x1 = Math.min(Math.max(positions.x1, chartRect.x1), chartRect.x2);
            positions.x2 = Math.min(Math.max(positions.x2, chartRect.x1), chartRect.x2);
            positions.y1 = Math.min(Math.max(positions.y1, chartRect.y2), chartRect.y1);
            positions.y2 = Math.min(Math.max(positions.y2, chartRect.y2), chartRect.y1);

            var metaData = Chartist.getMetaData(series, valueIndex);

            // Create bar element
            bar = seriesElement.elem('line', positions, options.classNames.bar).attr({
              'ct:value': [value.x, value.y].filter(Chartist.isNumeric).join(','),
              'ct:meta': Chartist.serialize(metaData)
            });

            this.eventEmitter.emit('draw', Chartist.extend({
              type: 'bar',
              value: value,
              index: valueIndex,
              meta: metaData,
              series: series,
              seriesIndex: seriesIndex,
              axisX: axisX,
              axisY: axisY,
              chartRect: chartRect,
              group: seriesElement,
              element: bar
            }, positions));
          }.bind(this));
        }.bind(this));

        this.eventEmitter.emit('created', {
          bounds: valueAxis.bounds,
          chartRect: chartRect,
          axisX: axisX,
          axisY: axisY,
          svg: this.svg,
          options: options
        });
      }

      /**
       * This method creates a new bar chart and returns API object that you can use for later changes.
       *
       * @memberof Chartist.Bar
       * @param {String|Node} query A selector query string or directly a DOM element
       * @param {Object} data The data object that needs to consist of a labels and a series array
       * @param {Object} [options] The options object with options that override the default options. Check the examples for a detailed list.
       * @param {Array} [responsiveOptions] Specify an array of responsive option arrays which are a media query and options object pair => [[mediaQueryString, optionsObject],[more...]]
       * @return {Object} An object which exposes the API for the created chart
       *
       * @example
       * // Create a simple bar chart
       * var data = {
       *   labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
       *   series: [
       *     [5, 2, 4, 2, 0]
       *   ]
       * };
       *
       * // In the global name space Chartist we call the Bar function to initialize a bar chart. As a first parameter we pass in a selector where we would like to get our chart created and as a second parameter we pass our data object.
       * new Chartist.Bar('.ct-chart', data);
       *
       * @example
       * // This example creates a bipolar grouped bar chart where the boundaries are limitted to -10 and 10
       * new Chartist.Bar('.ct-chart', {
       *   labels: [1, 2, 3, 4, 5, 6, 7],
       *   series: [
       *     [1, 3, 2, -5, -3, 1, -6],
       *     [-5, -2, -4, -1, 2, -3, 1]
       *   ]
       * }, {
       *   seriesBarDistance: 12,
       *   low: -10,
       *   high: 10
       * });
       *
       */
      function Bar(query, data, options, responsiveOptions) {
        Chartist.Bar.super.constructor.call(this,
          query,
          data,
          defaultOptions,
          Chartist.extend({}, defaultOptions, options),
          responsiveOptions);
      }

      // Creating bar chart type in Chartist namespace
      Chartist.Bar = Chartist.Base.extend({
        constructor: Bar,
        createChart: createChart
      });

    }(this || commonjsGlobal, Chartist));
    /* global Chartist */
    (function(globalRoot, Chartist) {

      globalRoot.window;
      globalRoot.document;

      /**
       * Default options in line charts. Expand the code view to see a detailed list of options with comments.
       *
       * @memberof Chartist.Pie
       */
      var defaultOptions = {
        // Specify a fixed width for the chart as a string (i.e. '100px' or '50%')
        width: undefined,
        // Specify a fixed height for the chart as a string (i.e. '100px' or '50%')
        height: undefined,
        // Padding of the chart drawing area to the container element and labels as a number or padding object {top: 5, right: 5, bottom: 5, left: 5}
        chartPadding: 5,
        // Override the class names that are used to generate the SVG structure of the chart
        classNames: {
          chartPie: 'ct-chart-pie',
          chartDonut: 'ct-chart-donut',
          series: 'ct-series',
          slicePie: 'ct-slice-pie',
          sliceDonut: 'ct-slice-donut',
          sliceDonutSolid: 'ct-slice-donut-solid',
          label: 'ct-label'
        },
        // The start angle of the pie chart in degrees where 0 points north. A higher value offsets the start angle clockwise.
        startAngle: 0,
        // An optional total you can specify. By specifying a total value, the sum of the values in the series must be this total in order to draw a full pie. You can use this parameter to draw only parts of a pie or gauge charts.
        total: undefined,
        // If specified the donut CSS classes will be used and strokes will be drawn instead of pie slices.
        donut: false,
        // If specified the donut segments will be drawn as shapes instead of strokes.
        donutSolid: false,
        // Specify the donut stroke width, currently done in javascript for convenience. May move to CSS styles in the future.
        // This option can be set as number or string to specify a relative width (i.e. 100 or '30%').
        donutWidth: 60,
        // If a label should be shown or not
        showLabel: true,
        // Label position offset from the standard position which is half distance of the radius. This value can be either positive or negative. Positive values will position the label away from the center.
        labelOffset: 0,
        // This option can be set to 'inside', 'outside' or 'center'. Positioned with 'inside' the labels will be placed on half the distance of the radius to the border of the Pie by respecting the 'labelOffset'. The 'outside' option will place the labels at the border of the pie and 'center' will place the labels in the absolute center point of the chart. The 'center' option only makes sense in conjunction with the 'labelOffset' option.
        labelPosition: 'inside',
        // An interpolation function for the label value
        labelInterpolationFnc: Chartist.noop,
        // Label direction can be 'neutral', 'explode' or 'implode'. The labels anchor will be positioned based on those settings as well as the fact if the labels are on the right or left side of the center of the chart. Usually explode is useful when labels are positioned far away from the center.
        labelDirection: 'neutral',
        // If true the whole data is reversed including labels, the series order as well as the whole series data arrays.
        reverseData: false,
        // If true empty values will be ignored to avoid drawing unncessary slices and labels
        ignoreEmptyValues: false
      };

      /**
       * Determines SVG anchor position based on direction and center parameter
       *
       * @param center
       * @param label
       * @param direction
       * @return {string}
       */
      function determineAnchorPosition(center, label, direction) {
        var toTheRight = label.x > center.x;

        if(toTheRight && direction === 'explode' ||
          !toTheRight && direction === 'implode') {
          return 'start';
        } else if(toTheRight && direction === 'implode' ||
          !toTheRight && direction === 'explode') {
          return 'end';
        } else {
          return 'middle';
        }
      }

      /**
       * Creates the pie chart
       *
       * @param options
       */
      function createChart(options) {
        var data = Chartist.normalizeData(this.data);
        var seriesGroups = [],
          labelsGroup,
          chartRect,
          radius,
          labelRadius,
          totalDataSum,
          startAngle = options.startAngle;

        // Create SVG.js draw
        this.svg = Chartist.createSvg(this.container, options.width, options.height,options.donut ? options.classNames.chartDonut : options.classNames.chartPie);
        // Calculate charting rect
        chartRect = Chartist.createChartRect(this.svg, options, defaultOptions.padding);
        // Get biggest circle radius possible within chartRect
        radius = Math.min(chartRect.width() / 2, chartRect.height() / 2);
        // Calculate total of all series to get reference value or use total reference from optional options
        totalDataSum = options.total || data.normalized.series.reduce(function(previousValue, currentValue) {
          return previousValue + currentValue;
        }, 0);

        var donutWidth = Chartist.quantity(options.donutWidth);
        if (donutWidth.unit === '%') {
          donutWidth.value *= radius / 100;
        }

        // If this is a donut chart we need to adjust our radius to enable strokes to be drawn inside
        // Unfortunately this is not possible with the current SVG Spec
        // See this proposal for more details: http://lists.w3.org/Archives/Public/www-svg/2003Oct/0000.html
        radius -= options.donut && !options.donutSolid ? donutWidth.value / 2  : 0;

        // If labelPosition is set to `outside` or a donut chart is drawn then the label position is at the radius,
        // if regular pie chart it's half of the radius
        if(options.labelPosition === 'outside' || options.donut && !options.donutSolid) {
          labelRadius = radius;
        } else if(options.labelPosition === 'center') {
          // If labelPosition is center we start with 0 and will later wait for the labelOffset
          labelRadius = 0;
        } else if(options.donutSolid) {
          labelRadius = radius - donutWidth.value / 2;
        } else {
          // Default option is 'inside' where we use half the radius so the label will be placed in the center of the pie
          // slice
          labelRadius = radius / 2;
        }
        // Add the offset to the labelRadius where a negative offset means closed to the center of the chart
        labelRadius += options.labelOffset;

        // Calculate end angle based on total sum and current data value and offset with padding
        var center = {
          x: chartRect.x1 + chartRect.width() / 2,
          y: chartRect.y2 + chartRect.height() / 2
        };

        // Check if there is only one non-zero value in the series array.
        var hasSingleValInSeries = data.raw.series.filter(function(val) {
          return val.hasOwnProperty('value') ? val.value !== 0 : val !== 0;
        }).length === 1;

        // Creating the series groups
        data.raw.series.forEach(function(series, index) {
          seriesGroups[index] = this.svg.elem('g', null, null);
        }.bind(this));
        //if we need to show labels we create the label group now
        if(options.showLabel) {
          labelsGroup = this.svg.elem('g', null, null);
        }

        // Draw the series
        // initialize series groups
        data.raw.series.forEach(function(series, index) {
          // If current value is zero and we are ignoring empty values then skip to next value
          if (data.normalized.series[index] === 0 && options.ignoreEmptyValues) return;

          // If the series is an object and contains a name or meta data we add a custom attribute
          seriesGroups[index].attr({
            'ct:series-name': series.name
          });

          // Use series class from series data or if not set generate one
          seriesGroups[index].addClass([
            options.classNames.series,
            (series.className || options.classNames.series + '-' + Chartist.alphaNumerate(index))
          ].join(' '));

          // If the whole dataset is 0 endAngle should be zero. Can't divide by 0.
          var endAngle = (totalDataSum > 0 ? startAngle + data.normalized.series[index] / totalDataSum * 360 : 0);

          // Use slight offset so there are no transparent hairline issues
          var overlappigStartAngle = Math.max(0, startAngle - (index === 0 || hasSingleValInSeries ? 0 : 0.2));

          // If we need to draw the arc for all 360 degrees we need to add a hack where we close the circle
          // with Z and use 359.99 degrees
          if(endAngle - overlappigStartAngle >= 359.99) {
            endAngle = overlappigStartAngle + 359.99;
          }

          var start = Chartist.polarToCartesian(center.x, center.y, radius, overlappigStartAngle),
            end = Chartist.polarToCartesian(center.x, center.y, radius, endAngle);

          var innerStart,
            innerEnd,
            donutSolidRadius;

          // Create a new path element for the pie chart. If this isn't a donut chart we should close the path for a correct stroke
          var path = new Chartist.Svg.Path(!options.donut || options.donutSolid)
            .move(end.x, end.y)
            .arc(radius, radius, 0, endAngle - startAngle > 180, 0, start.x, start.y);

          // If regular pie chart (no donut) we add a line to the center of the circle for completing the pie
          if(!options.donut) {
            path.line(center.x, center.y);
          } else if (options.donutSolid) {
            donutSolidRadius = radius - donutWidth.value;
            innerStart = Chartist.polarToCartesian(center.x, center.y, donutSolidRadius, startAngle - (index === 0 || hasSingleValInSeries ? 0 : 0.2));
            innerEnd = Chartist.polarToCartesian(center.x, center.y, donutSolidRadius, endAngle);
            path.line(innerStart.x, innerStart.y);
            path.arc(donutSolidRadius, donutSolidRadius, 0, endAngle - startAngle  > 180, 1, innerEnd.x, innerEnd.y);
          }

          // Create the SVG path
          // If this is a donut chart we add the donut class, otherwise just a regular slice
          var pathClassName = options.classNames.slicePie;
          if (options.donut) {
            pathClassName = options.classNames.sliceDonut;
            if (options.donutSolid) {
              pathClassName = options.classNames.sliceDonutSolid;
            }
          }
          var pathElement = seriesGroups[index].elem('path', {
            d: path.stringify()
          }, pathClassName);

          // Adding the pie series value to the path
          pathElement.attr({
            'ct:value': data.normalized.series[index],
            'ct:meta': Chartist.serialize(series.meta)
          });

          // If this is a donut, we add the stroke-width as style attribute
          if(options.donut && !options.donutSolid) {
            pathElement._node.style.strokeWidth = donutWidth.value + 'px';
          }

          // Fire off draw event
          this.eventEmitter.emit('draw', {
            type: 'slice',
            value: data.normalized.series[index],
            totalDataSum: totalDataSum,
            index: index,
            meta: series.meta,
            series: series,
            group: seriesGroups[index],
            element: pathElement,
            path: path.clone(),
            center: center,
            radius: radius,
            startAngle: startAngle,
            endAngle: endAngle
          });

          // If we need to show labels we need to add the label for this slice now
          if(options.showLabel) {
            var labelPosition;
            if(data.raw.series.length === 1) {
              // If we have only 1 series, we can position the label in the center of the pie
              labelPosition = {
                x: center.x,
                y: center.y
              };
            } else {
              // Position at the labelRadius distance from center and between start and end angle
              labelPosition = Chartist.polarToCartesian(
                center.x,
                center.y,
                labelRadius,
                startAngle + (endAngle - startAngle) / 2
              );
            }

            var rawValue;
            if(data.normalized.labels && !Chartist.isFalseyButZero(data.normalized.labels[index])) {
              rawValue = data.normalized.labels[index];
            } else {
              rawValue = data.normalized.series[index];
            }

            var interpolatedValue = options.labelInterpolationFnc(rawValue, index);

            if(interpolatedValue || interpolatedValue === 0) {
              var labelElement = labelsGroup.elem('text', {
                dx: labelPosition.x,
                dy: labelPosition.y,
                'text-anchor': determineAnchorPosition(center, labelPosition, options.labelDirection)
              }, options.classNames.label).text('' + interpolatedValue);

              // Fire off draw event
              this.eventEmitter.emit('draw', {
                type: 'label',
                index: index,
                group: labelsGroup,
                element: labelElement,
                text: '' + interpolatedValue,
                x: labelPosition.x,
                y: labelPosition.y
              });
            }
          }

          // Set next startAngle to current endAngle.
          // (except for last slice)
          startAngle = endAngle;
        }.bind(this));

        this.eventEmitter.emit('created', {
          chartRect: chartRect,
          svg: this.svg,
          options: options
        });
      }

      /**
       * This method creates a new pie chart and returns an object that can be used to redraw the chart.
       *
       * @memberof Chartist.Pie
       * @param {String|Node} query A selector query string or directly a DOM element
       * @param {Object} data The data object in the pie chart needs to have a series property with a one dimensional data array. The values will be normalized against each other and don't necessarily need to be in percentage. The series property can also be an array of value objects that contain a value property and a className property to override the CSS class name for the series group.
       * @param {Object} [options] The options object with options that override the default options. Check the examples for a detailed list.
       * @param {Array} [responsiveOptions] Specify an array of responsive option arrays which are a media query and options object pair => [[mediaQueryString, optionsObject],[more...]]
       * @return {Object} An object with a version and an update method to manually redraw the chart
       *
       * @example
       * // Simple pie chart example with four series
       * new Chartist.Pie('.ct-chart', {
       *   series: [10, 2, 4, 3]
       * });
       *
       * @example
       * // Drawing a donut chart
       * new Chartist.Pie('.ct-chart', {
       *   series: [10, 2, 4, 3]
       * }, {
       *   donut: true
       * });
       *
       * @example
       * // Using donut, startAngle and total to draw a gauge chart
       * new Chartist.Pie('.ct-chart', {
       *   series: [20, 10, 30, 40]
       * }, {
       *   donut: true,
       *   donutWidth: 20,
       *   startAngle: 270,
       *   total: 200
       * });
       *
       * @example
       * // Drawing a pie chart with padding and labels that are outside the pie
       * new Chartist.Pie('.ct-chart', {
       *   series: [20, 10, 30, 40]
       * }, {
       *   chartPadding: 30,
       *   labelOffset: 50,
       *   labelDirection: 'explode'
       * });
       *
       * @example
       * // Overriding the class names for individual series as well as a name and meta data.
       * // The name will be written as ct:series-name attribute and the meta data will be serialized and written
       * // to a ct:meta attribute.
       * new Chartist.Pie('.ct-chart', {
       *   series: [{
       *     value: 20,
       *     name: 'Series 1',
       *     className: 'my-custom-class-one',
       *     meta: 'Meta One'
       *   }, {
       *     value: 10,
       *     name: 'Series 2',
       *     className: 'my-custom-class-two',
       *     meta: 'Meta Two'
       *   }, {
       *     value: 70,
       *     name: 'Series 3',
       *     className: 'my-custom-class-three',
       *     meta: 'Meta Three'
       *   }]
       * });
       */
      function Pie(query, data, options, responsiveOptions) {
        Chartist.Pie.super.constructor.call(this,
          query,
          data,
          defaultOptions,
          Chartist.extend({}, defaultOptions, options),
          responsiveOptions);
      }

      // Creating pie chart type in Chartist namespace
      Chartist.Pie = Chartist.Base.extend({
        constructor: Pie,
        createChart: createChart,
        determineAnchorPosition: determineAnchorPosition
      });

    }(this || commonjsGlobal, Chartist));

    return Chartist;

    }));
    });

    /* src/components/Net.svelte generated by Svelte v3.32.3 */

    const { console: console_1$1 } = globals;
    const file$9 = "src/components/Net.svelte";

    function create_fragment$9(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "ct-chart ct-golden-section");
    			attr_dev(div, "id", "chart1");
    			add_location(div, file$9, 58, 0, 1662);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
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

    	console.log([...yearsMap].map(([year, data]) => netIncome(data)));

    	onMount(() => {
    		// Initialize a Line chart in the container with the ID chart1
    		// chart.on("draw", function (data) {
    		new chartist.Line(".ct-chart",
    		{
    				labels: allYears,
    				series: [[...yearsMap].map(([year, data]) => netIncome(data))]
    			},
    		{
    				low: 0,
    				showArea: false,
    				showPoint: true,
    				fullWidth: true
    			});

    		// chart.on("draw", function (data) {
    		//   if (data.type === "line" || data.type === "area") {
    		//     data.element.animate({
    		//       d: {
    		//         begin: 2000 * data.index,
    		//         dur: 2000,
    		//         from: data.path
    		//           .clone()
    		//           .scale(1, 0)
    		//           .translate(0, data.chartRect.height())
    		//           .stringify(),
    		//         to: data.path.clone().stringify(),
    		//         easing: Chartist.Svg.Easing.easeOutQuint,
    		//       },
    		//     });
    		//   }
    		// });
    		setTimeout(
    			function () {
    				var path = document.querySelector(".ct-series-a path");
    				var length = path.getTotalLength();
    				console.log(length);
    			},
    			3000
    		);
    	});

    	const writable_props = ["fullData"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$1.warn(`<Net> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("fullData" in $$props) $$invalidate(0, fullData = $$props.fullData);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		getContext,
    		Chartist: chartist,
    		netIncome,
    		fullData,
    		allYears,
    		aYearData,
    		yearsMap
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
    			console_1$1.warn("<Net> was created without expected prop 'fullData'");
    		}
    	}

    	get fullData() {
    		throw new Error("<Net>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fullData(value) {
    		throw new Error("<Net>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Net2.svelte generated by Svelte v3.32.3 */
    const file$a = "src/components/Net2.svelte";

    function create_fragment$a(ctx) {
    	let div;
    	let svg;

    	const block = {
    		c: function create() {
    			div = element("div");
    			svg = svg_element("svg");
    			attr_dev(svg, "class", "svelte-t7rmx2");
    			add_location(svg, file$a, 60, 2, 1789);
    			attr_dev(div, "id", "chart");
    			attr_dev(div, "class", "svelte-t7rmx2");
    			add_location(div, file$a, 59, 0, 1770);
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
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Net2", slots, []);
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

    		chart.xAxis.axisLabel("Year").tickFormat(d3.format(",r")); //Chart x-axis settings
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
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Net2> was created with unknown prop '${key}'`);
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

    class Net2 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, { fullData: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Net2",
    			options,
    			id: create_fragment$a.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*fullData*/ ctx[0] === undefined && !("fullData" in props)) {
    			console.warn("<Net2> was created without expected prop 'fullData'");
    		}
    	}

    	get fullData() {
    		throw new Error("<Net2>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set fullData(value) {
    		throw new Error("<Net2>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.32.3 */

    const file$b = "src/App.svelte";

    // (1:0) <script>   import {         psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }
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
    		source: "(1:0) <script>   import {         psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }",
    		ctx
    	});

    	return block;
    }

    // (67:25)    <span style="display:none;"     >{setContext("plansdata", {       allYears: plansContext(data),       fullData: data,     }
    function create_then_block(ctx) {
    	let span;

    	let t0_value = setContext("plansdata", {
    		allYears: plansContext(/*data*/ ctx[8]),
    		fullData: /*data*/ ctx[8]
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
    	let sider;
    	let t5;
    	let section1;
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
    	sider.$on("senddataparam", /*changeParam*/ ctx[7]);

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block_5,
    		then: create_then_block_5,
    		catch: create_catch_block_4,
    		value: 8,
    		blocks: [,,,]
    	};

    	handle_promise(promise = /*$psVolume*/ ctx[2], info);

    	let info_1 = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block_4,
    		then: create_then_block_4,
    		catch: create_catch_block_3,
    		value: 8,
    		blocks: [,,,]
    	};

    	handle_promise(promise_1 = /*$revenue*/ ctx[3], info_1);

    	let info_2 = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block_3,
    		then: create_then_block_3,
    		catch: create_catch_block_2,
    		value: 8,
    		blocks: [,,,]
    	};

    	handle_promise(promise_2 = /*$expense*/ ctx[4], info_2);

    	let info_3 = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block_2,
    		then: create_then_block_2,
    		catch: create_catch_block_1,
    		value: 8,
    		blocks: [,,,]
    	};

    	handle_promise(promise_3 = /*$budget*/ ctx[5], info_3);

    	let info_4 = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block_1,
    		then: create_then_block_1,
    		catch: create_catch_block,
    		value: 8,
    		blocks: [,,,]
    	};

    	handle_promise(promise_4 = /*$tax*/ ctx[6], info_4);

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
    			create_component(sider.$$.fragment);
    			t5 = space();
    			section1 = element("section");
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
    			add_location(span, file$b, 67, 2, 1946);
    			attr_dev(section0, "class", "middle flex-c svelte-pzsx7b");
    			add_location(section0, file$b, 74, 4, 2110);
    			attr_dev(section1, "class", "last flex-c svelte-pzsx7b");
    			add_location(section1, file$b, 86, 4, 2434);
    			attr_dev(main, "class", "flex-r svelte-pzsx7b");
    			add_location(main, file$b, 73, 2, 2084);
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
    			mount_component(sider, main, null);
    			append_dev(main, t5);
    			append_dev(main, section1);
    			info.block.m(section1, info.anchor = null);
    			info.mount = () => section1;
    			info.anchor = t6;
    			append_dev(section1, t6);
    			info_1.block.m(section1, info_1.anchor = null);
    			info_1.mount = () => section1;
    			info_1.anchor = t7;
    			append_dev(section1, t7);
    			info_2.block.m(section1, info_2.anchor = null);
    			info_2.mount = () => section1;
    			info_2.anchor = t8;
    			append_dev(section1, t8);
    			info_3.block.m(section1, info_3.anchor = null);
    			info_3.mount = () => section1;
    			info_3.anchor = t9;
    			append_dev(section1, t9);
    			info_4.block.m(section1, info_4.anchor = null);
    			info_4.mount = () => section1;
    			info_4.anchor = null;
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if ((!current || dirty & /*$plans*/ 2) && t0_value !== (t0_value = setContext("plansdata", {
    				allYears: plansContext(/*data*/ ctx[8]),
    				fullData: /*data*/ ctx[8]
    			}) + "")) set_data_dev(t0, t0_value);

    			const card0_changes = {};

    			if (dirty & /*$$scope, $plans*/ 514) {
    				card0_changes.$$scope = { dirty, ctx };
    			}

    			card0.$set(card0_changes);
    			const card1_changes = {};

    			if (dirty & /*$$scope, $plans*/ 514) {
    				card1_changes.$$scope = { dirty, ctx };
    			}

    			card1.$set(card1_changes);
    			info.ctx = ctx;

    			if (dirty & /*$psVolume*/ 4 && promise !== (promise = /*$psVolume*/ ctx[2]) && handle_promise(promise, info)) ; else {
    				const child_ctx = ctx.slice();
    				child_ctx[8] = info.resolved;
    				info.block.p(child_ctx, dirty);
    			}

    			info_1.ctx = ctx;

    			if (dirty & /*$revenue*/ 8 && promise_1 !== (promise_1 = /*$revenue*/ ctx[3]) && handle_promise(promise_1, info_1)) ; else {
    				const child_ctx = ctx.slice();
    				child_ctx[8] = info_1.resolved;
    				info_1.block.p(child_ctx, dirty);
    			}

    			info_2.ctx = ctx;

    			if (dirty & /*$expense*/ 16 && promise_2 !== (promise_2 = /*$expense*/ ctx[4]) && handle_promise(promise_2, info_2)) ; else {
    				const child_ctx = ctx.slice();
    				child_ctx[8] = info_2.resolved;
    				info_2.block.p(child_ctx, dirty);
    			}

    			info_3.ctx = ctx;

    			if (dirty & /*$budget*/ 32 && promise_3 !== (promise_3 = /*$budget*/ ctx[5]) && handle_promise(promise_3, info_3)) ; else {
    				const child_ctx = ctx.slice();
    				child_ctx[8] = info_3.resolved;
    				info_3.block.p(child_ctx, dirty);
    			}

    			info_4.ctx = ctx;

    			if (dirty & /*$tax*/ 64 && promise_4 !== (promise_4 = /*$tax*/ ctx[6]) && handle_promise(promise_4, info_4)) ; else {
    				const child_ctx = ctx.slice();
    				child_ctx[8] = info_4.resolved;
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
    		source: "(67:25)    <span style=\\\"display:none;\\\"     >{setContext(\\\"plansdata\\\", {       allYears: plansContext(data),       fullData: data,     }",
    		ctx
    	});

    	return block;
    }

    // (76:6) <Card>
    function create_default_slot_1(ctx) {
    	let toptable;
    	let current;

    	toptable = new TopTable({
    			props: { fullData: /*data*/ ctx[8] },
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
    			if (dirty & /*$plans*/ 2) toptable_changes.fullData = /*data*/ ctx[8];
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
    		source: "(76:6) <Card>",
    		ctx
    	});

    	return block;
    }

    // (80:6) <Card>
    function create_default_slot(ctx) {
    	let net2;
    	let current;

    	net2 = new Net2({
    			props: { fullData: /*data*/ ctx[8] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(net2.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(net2, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const net2_changes = {};
    			if (dirty & /*$plans*/ 2) net2_changes.fullData = /*data*/ ctx[8];
    			net2.$set(net2_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(net2.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(net2.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(net2, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(80:6) <Card>",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import {         psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }
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
    		source: "(1:0) <script>   import {         psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }",
    		ctx
    	});

    	return block;
    }

    // (88:34)          <PlanTables           {data}
    function create_then_block_5(ctx) {
    	let plantables;
    	let current;

    	plantables = new PlanTables({
    			props: {
    				data: /*data*/ ctx[8],
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
    			if (dirty & /*$psVolume*/ 4) plantables_changes.data = /*data*/ ctx[8];
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
    		source: "(88:34)          <PlanTables           {data}",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import {         psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }
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
    		source: "(1:0) <script>   import {         psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import {         psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }
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
    		source: "(1:0) <script>   import {         psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }",
    		ctx
    	});

    	return block;
    }

    // (95:33)          <PlanTables {data}
    function create_then_block_4(ctx) {
    	let plantables;
    	let current;

    	plantables = new PlanTables({
    			props: {
    				data: /*data*/ ctx[8],
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
    			if (dirty & /*$revenue*/ 8) plantables_changes.data = /*data*/ ctx[8];
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
    		source: "(95:33)          <PlanTables {data}",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import {         psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }
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
    		source: "(1:0) <script>   import {         psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import {         psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }
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
    		source: "(1:0) <script>   import {         psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }",
    		ctx
    	});

    	return block;
    }

    // (98:33)          <PlanTables           {data}
    function create_then_block_3(ctx) {
    	let plantables;
    	let current;

    	plantables = new PlanTables({
    			props: {
    				data: /*data*/ ctx[8],
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
    			if (dirty & /*$expense*/ 16) plantables_changes.data = /*data*/ ctx[8];
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
    		source: "(98:33)          <PlanTables           {data}",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import {         psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }
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
    		source: "(1:0) <script>   import {         psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import {         psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }
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
    		source: "(1:0) <script>   import {         psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }",
    		ctx
    	});

    	return block;
    }

    // (105:32)          <PlanTables           {data}
    function create_then_block_2(ctx) {
    	let plantables;
    	let current;

    	plantables = new PlanTables({
    			props: {
    				data: /*data*/ ctx[8],
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
    			if (dirty & /*$budget*/ 32) plantables_changes.data = /*data*/ ctx[8];
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
    		source: "(105:32)          <PlanTables           {data}",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import {         psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }
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
    		source: "(1:0) <script>   import {         psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import {         psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }
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
    		source: "(1:0) <script>   import {         psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }",
    		ctx
    	});

    	return block;
    }

    // (112:29)        <PlanTables         {data}
    function create_then_block_1(ctx) {
    	let plantables;
    	let current;

    	plantables = new PlanTables({
    			props: {
    				data: /*data*/ ctx[8],
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
    			if (dirty & /*$tax*/ 64) plantables_changes.data = /*data*/ ctx[8];
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
    		source: "(112:29)        <PlanTables         {data}",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import {         psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }
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
    		source: "(1:0) <script>   import {         psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }",
    		ctx
    	});

    	return block;
    }

    // (1:0) <script>   import {         psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }
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
    		source: "(1:0) <script>   import {         psVolume,     revenue,     expense,     budget,     tax,     plans,     yearParam,   }",
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
    	let await_block_anchor;
    	let promise;
    	let current;
    	nav = new Nav({ $$inline: true });

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block,
    		then: create_then_block,
    		catch: create_catch_block_5,
    		value: 8,
    		blocks: [,,,]
    	};

    	handle_promise(promise = /*$plans*/ ctx[1], info);

    	const block = {
    		c: function create() {
    			create_component(nav.$$.fragment);
    			t0 = space();
    			div1 = element("div");
    			div0 = element("div");
    			span = element("span");
    			span.textContent = "NEPL CONSOLIDATED PLAN";
    			t2 = space();
    			await_block_anchor = empty();
    			info.block.c();
    			attr_dev(span, "class", "svelte-pzsx7b");
    			add_location(span, file$b, 63, 4, 1866);
    			add_location(div0, file$b, 62, 2, 1856);
    			attr_dev(div1, "class", "app-header r-mono flex-c center-first svelte-pzsx7b");
    			add_location(div1, file$b, 61, 0, 1802);
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
    			insert_dev(target, await_block_anchor, anchor);
    			info.block.m(target, info.anchor = anchor);
    			info.mount = () => await_block_anchor.parentNode;
    			info.anchor = await_block_anchor;
    			current = true;
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;
    			info.ctx = ctx;

    			if (dirty & /*$plans*/ 2 && promise !== (promise = /*$plans*/ ctx[1]) && handle_promise(promise, info)) ; else {
    				const child_ctx = ctx.slice();
    				child_ctx[8] = info.resolved;
    				info.block.p(child_ctx, dirty);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(nav.$$.fragment, local);
    			transition_in(info.block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(nav.$$.fragment, local);

    			for (let i = 0; i < 3; i += 1) {
    				const block = info.blocks[i];
    				transition_out(block);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(nav, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(await_block_anchor);
    			info.block.d(detaching);
    			info.token = null;
    			info = null;
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
    	component_subscribe($$self, psVolume, $$value => $$invalidate(2, $psVolume = $$value));
    	validate_store(revenue, "revenue");
    	component_subscribe($$self, revenue, $$value => $$invalidate(3, $revenue = $$value));
    	validate_store(expense, "expense");
    	component_subscribe($$self, expense, $$value => $$invalidate(4, $expense = $$value));
    	validate_store(budget, "budget");
    	component_subscribe($$self, budget, $$value => $$invalidate(5, $budget = $$value));
    	validate_store(tax, "tax");
    	component_subscribe($$self, tax, $$value => $$invalidate(6, $tax = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let dataParam;

    	const changeParam = e => {
    		$$invalidate(0, dataParam = e.detail.param);
    		yearParam.set(dataParam);
    		psVolume.set(getProductionSalesVolumePerYear({ year: dataParam }));
    		revenue.set(getRevenuePerYear({ year: dataParam }));
    		expense.set(getExpensePerYear({ year: dataParam }));
    		budget.set(getBudgetCostPerYear({ year: dataParam }));
    		tax.set(getTaxPerYear({ year: dataParam }));
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
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
    		Net2,
    		getProductionSalesVolumePerYear,
    		getRevenuePerYear,
    		getExpensePerYear,
    		getBudgetCostPerYear,
    		getTaxPerYear,
    		dataParam,
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
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$plans, dataParam*/ 3) {
    			onMount(async () => {
    				let data = await $plans;
    				$$invalidate(0, dataParam = plansContext(data)[0]);
    				yearParam.set(dataParam);
    				psVolume.set(getProductionSalesVolumePerYear({ year: dataParam }));
    				revenue.set(getRevenuePerYear({ year: dataParam }));
    				expense.set(getExpensePerYear({ year: dataParam }));
    				budget.set(getBudgetCostPerYear({ year: dataParam }));
    				tax.set(getTaxPerYear({ year: dataParam }));
    			});
    		}
    	};

    	return [dataParam, $plans, $psVolume, $revenue, $expense, $budget, $tax, changeParam];
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
