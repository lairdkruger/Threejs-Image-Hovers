const container = document.body
const itemsWrapper = document.querySelector('.link-container')

// Preload images
const preloadImages = () => {
    return new Promise((resolve, reject) => {
        imagesLoaded(document.querySelectorAll('img'), resolve);
    });
};
// And then..
preloadImages().then(() => {
    // Remove the loader
    document.body.classList.remove('loading');

    //const effect = new RGBShiftEffect(container, itemsWrapper)
    //const effect = new SmoothFadeTransitionEffect(container, itemsWrapper)
    //const effect = new FlyEyeTransitionEffect(container, itemsWrapper)
    //const effect = new RippleTransitionEffect(container, itemsWrapper)
    const effect = new PerlinTransitionEffect(container, itemsWrapper)
    //const effect = new MorphTransitionEffect(container, itemsWrapper)

});



