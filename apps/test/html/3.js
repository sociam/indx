function onLoad()
{
    // Grab our container div
    var container = document.getElementById("container");
    // Create the Three.js renderer, add it to our div
    var renderer = new THREE.WebGLRenderer();
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    container.appendChild( renderer.domElement );
    // Create a new Three.js scene
    var scene = new THREE.Scene();
    // Create a camera and add it to the scene
    var camera = new THREE.Camera( 45, container.offsetWidth / container.offsetHeight, 1, 4000 );
    camera.position.set( 0, 0, 3.3333 );
    scene.addObject( camera );
    // Now, create a rectangle and add it to the scene
    var geometry = new THREE.CubeGeometry(1, 1, 1);

	var mapUrl = "img/texture.jpg";
	var map = THREE.ImageUtils.loadTexture(mapUrl);
    var mesh = new THREE.Mesh( geometry, new THREE.MeshPhongMaterial({ map: map }));

	// Create a directional light to show off the object
	var light = new THREE.DirectionalLight( 0xffffff, 1.5);
	light.position.set(0, 0, 1);
	scene.addObject( light );	

    scene.addObject( mesh );
	// Render it
    renderer.render( scene, camera );
	window.mesh = mesh;
	window.scene = scene;
	var amp_x = 0;
	var t = 0;
	
	requestAnimationFrame(function() {
    	// mesh.rotation.x = Math.PI/5 * 0.04*(Math.random() - 0.5);
    	// mesh.rotation.y = Math.PI/5 * 0.04*(Math.random() - 0.5);	
  	    // mesh.rotation.z = 0.25*Math.PI*Math.pow(2.71828, -(0.05*amp_x))*(Math.random() - 0.5);
		mesh.rotation.y = 0.20*Math.PI*Math.pow(2.71828, -(0.05*amp_x))*Math.sin(0.1*t++);
		//mesh.position.x = 1*(Math.random()-0.5);
		//mesh.position.y = 1*(Math.random()-0.5);
		// mesh.position.z = (Math.random()-0.5);
  		// mesh.update();

        renderer.render(scene,camera);
	    requestAnimationFrame(arguments.callee);
		amp_x++;
    });

	$(document).on('mousemove', function(evt) {
		var r = 2.0*Math.PI*(evt.clientX/$(window).width()) - Math.PI;
		// mesh.rotation.x = r;
		r = 2.0*Math.PI*(evt.clientY/$(window).height()) - Math.PI;				
		// mesh.rotation.y = r;
		amp_x = 0;
	});

	
}
