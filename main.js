import * as THREE from 'three';
import { gsap } from 'gsap';

const width = window.innerWidth, height = window.innerHeight;

// init

const camera = new THREE.PerspectiveCamera( 70, width / height, 0.01, 10 );
camera.position.z = 1;

const scene = new THREE.Scene();

const geometry = new THREE.BoxGeometry( 0.2, 0.2, 0.2 );
const material = new THREE.MeshNormalMaterial();

const mesh = new THREE.Mesh( geometry, material );
scene.add( mesh );

const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setSize( width, height );
renderer.setAnimationLoop( () => renderer.render( scene, camera ) );
document.body.appendChild( renderer.domElement );

// animation

gsap.to( mesh.rotation, {
	x: Math.PI * 2,
	y: Math.PI * 2,
	duration: 4,
	ease: 'none',
	repeat: -1,
} );
