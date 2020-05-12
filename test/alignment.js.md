
# doxic -- a Tool for executable docs

This is a [docco]-inspired tool to create documentation pages in a Howto-style
that allow the reader to see the code examples run.

Click the <button disabled>Run</button> in this example to see it in action.
~~~ javascript { runnable: true }
window.alert("See? It's really simple!");
~~~


Some short text (just a short paragraph).

Some more short Text (yeah, another paragraph).

~~~ javascript { runnable: true }
// some extraordinarily long code here (use your imagination)
alert('it works!');
/*












*/
~~~

If I could find my lorem ipsum generator, that's what you'd see here.

Unfortunately I have not the faintest idea where the darned thing
is hiding right now, which leads me to producing the drivel you are
reading at the moment. It's not pretty, I know, but it will certainly do
the job.

---

Editable code:

~~~ javascript { runnable: true, editable: true }
// some extraordinarily long code here (use your imagination)
alert('it works!');
/*












*/
~~~

---

`--->`

More text that could have been fake latin, but is not.

Here comes a small image, to use up some more space:

![An image](https://loremicon.com/100/100)

Some more Text.

    <--- (arrows should be aligned)
    window.alert('just some code -- no options, therefor not runnable');
    /* this block should be right next to "More text that could have been..." */

## Usage

***






---

Links

[docco]

[docco]:http://github.com/jashkenas/docco
