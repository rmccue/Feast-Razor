<?php

function razor_setup() {
	if ( ! is_admin() ) {
		add_action('wp_print_styles', 'razor_enqueue_styles');
		add_action('wp_print_scripts', 'razor_enqueue_scripts');
	}
}
add_action( 'after_setup_theme', 'razor_setup' );
function razor_enqueue_styles() {
	wp_enqueue_style('razor-fancybox', get_stylesheet_directory_uri() . '/resources/fancybox/fancybox.css');
	wp_enqueue_style('razor-genericons', get_stylesheet_directory_uri() . '/resources/genericons.css');
}

function razor_enqueue_scripts() {
	global $wp_version;
	if (version_compare($wp_version, '3.5.1', 'le')) {
		wp_deregister_script('backbone');
		wp_enqueue_script('backbone', get_stylesheet_directory_uri() . '/resources/backbone.js', array('underscore', 'jquery'), '1.0.0');
	}
	wp_enqueue_script('razor-core', get_stylesheet_directory_uri() . '/core.js', array('jquery', 'backbone'));
}