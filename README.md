
experimental documentation generator

installation (for now):

  npm link



# doxic -- a Tool for executable docs <!-- omit in toc -->

Documentation generator inspired by [docco] that allows examples to be run.

Only the `parallel` template has the required support code for running 
examples.

##  What it is about

In order to make the documentation easier to understand, example code
can be run directly in the page where it is displayed. If it makes sense,
examples can also be edited.

## Code Examples

The following markdown will create a page that has the explanation, the 
example code and a <button disabled>run</button> button that can be used
to actually run the code in the browser.

   ````markdown

    Click the <button disabled>Run</button> in this example to see it in action.
    ~~~ javascript { runnable: true }
    window.alert("See? It's really simple!");
    ~~~

    ````

You may want some support code to always run:

   ````markdown

    ~~~ { inject: 'script' }
    function showAlert(text) {
      window.alert(text);
    }
    ~~~



    Click the <button disabled>Run</button> in this example to see it in action.
    ~~~ javascript { runnable: true }
    showAlert("See? It's really simple!"); // uses the function defined above
    ~~~

    ````



Links

[docco]

[docco]:http://github.com/jashkenas/docco
