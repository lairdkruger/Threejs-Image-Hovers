class FlyEyeTransitionEffect extends EffectShell {
    constructor(container = document.body, itemsWrapper = null) {
        super(container, itemsWrapper)
        if (!this.container || !this.itemsWrapper) return

        this.init()
    }

    init() {
        // create plane buffer geometry
        this.position = new THREE.Vector3(0, 0, 0)

        // how strictly the plane follows the cursor
        this.followStrength = 0.25

        // (width, height, wSegments, hSegments)
        // more segments: smoother mesh distortion
        this.geometry = new THREE.PlaneBufferGeometry(1.0, 1.0, 8, 8)
        this.uniforms = {
            uTime: {
                value: 0
            },
            uTexture: {
                value: null
            },
            uPreviousTexture: {
                value: null
            },
            uMixValue: {
                value: 0.0
            },
            uOffset: {
                value: new THREE.Vector2(0.0, 0.0)
            },
            uAlpha: {
                value: 0.0
            }
        }

        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: `
            uniform vec2 uOffset;

            varying vec2 vUv;

            vec3 deformationCurve(vec3 position, vec2 uv, vec2 offset) {
            float M_PI = 3.1415926535897932384626433832795;
            position.x = position.x + (sin(uv.y * M_PI) * offset.x);
            position.y = position.y + (sin(uv.x * M_PI) * offset.y);
            return position;
            }

            void main() {
                vUv =  uv;
                vec3 newPosition = position;
                newPosition = deformationCurve(position,uv,uOffset);
                gl_Position = projectionMatrix * modelViewMatrix * vec4( newPosition, 1.0 );
            }
        `,
            fragmentShader: `
            uniform sampler2D uTexture;
            uniform sampler2D uPreviousTexture;
            uniform float uAlpha;
            uniform float uMixValue;
    
            float size = 0.05;
            float zoom = 20.0;
            float colorSeparation = 0.3;
            
            varying vec2 vUv;
    
            vec2 scaleUV(vec2 uv, float scale) {
                float center = 0.5;
                return ((uv - center) * scale) + center;
            }

            vec3 transition(vec2 p) {
                // basically:  https://github.com/gl-transitions/gl-transitions/blob/master/transitions/flyeye.glsl
                float inv = 1. - uMixValue;
                vec2 disp = size*vec2(cos(zoom*p.x), sin(zoom*p.y));
                //vec4 texTo = vec4(texture2D(uTexture, inv*disp));
                vec4 texTo = vec4(texture2D(uTexture, vUv + inv*disp));
                vec4 texFrom = vec4(
                    texture2D(uPreviousTexture, vUv + uMixValue*disp*(1.0 - colorSeparation)).r,

                    texture2D(uPreviousTexture, vUv + uMixValue*disp).g,

                    texture2D(uPreviousTexture, vUv + uMixValue*disp*(1.0 + colorSeparation), 1.0).b, 1.0);

                return vec3(texTo*uMixValue + texFrom*inv);
            }
    
            void main() {
                gl_FragColor = vec4(transition(vUv), uAlpha);
            }
        `,
            transparent: true
        })


        this.plane = new THREE.Mesh(this.geometry, this.material)
        this.scene.add(this.plane)
    }

    onMouseEnter() {
        // if mouse enters over a new item
        if (!this.currentItem || !this.isMouseOver) {
            this.isMouseOver = true
            // show plane (increase opacity to 1.0)
            TweenLite.to(this.uniforms.uAlpha, 0.5, {
                value: 1.0,
                ease: Power4.easeOut
            })
        }
    }

    onMouseLeave(event) {
        // ease opacity (uAlpha) to 0 on mouse leave
        TweenLite.to(this.uniforms.uAlpha, 0.5, {
            value: 0,
            ease: Power4.easeOut
        })
    }

    onMouseMove(event) {
        // project mouse position to threejs 3d world coodinates
        let x = this.mouse.x.map(
            -1,
            1,
            -this.viewSize.width / 2,
            this.viewSize.width / 2
        )
        let y = this.mouse.y.map(
            -1,
            1,
            -this.viewSize.height / 2,
            this.viewSize.height / 2
        )

        // update planes position to the mouse position
        this.position = new THREE.Vector3(x, y, 0)
        TweenLite.to(this.plane.position, 1, {
            x: x,
            y: y,
            ease: Power4.easeOut,
            onUpdate: this.onPositionUpdate.bind(this)
        })
    }

    onPositionUpdate() {
        // compute offset using plane's velocity
        let offset = this.plane.position
            .clone()
            .sub(this.position)
            .multiplyScalar(-this.followStrength)
        this.uniforms.uOffset.value = offset
    }

    onMouseOver(index, e) {
        // if EffectShell has not been loaded yet, don't carry on with function (return)
        if (!this.isLoaded) return

        // trigger mouseEnter events (show plane)
        this.onMouseEnter()

        // if the newly hovered item is the same as the last hovered item
        // there is no need for a target change, hence return
        if (this.currentItem && this.currentItem.index == index) return

        // if the hovered item is not the first, update previous texture
        if (this.currentItem) {
            this.uniforms.uPreviousTexture.value = this.items[this.currentItem.index].texture;
        }

        this.onTargetChange(index)
    }

    onTargetChange(index) {
        var requiredClass = this;

        // cancel the mix value from incrementing
        clearInterval(requiredClass.mixValue)

        // item target changed
        this.currentItem = this.items[index]

        // if new target item does not have a texture, stop
        if (!this.currentItem.texture) return

        // compute image ratio
        let imageRatio = this.currentItem.img.naturalWidth / this.currentItem.img.naturalHeight
        this.scale = new THREE.Vector3(imageRatio, 1, 1)

        // assign it a texture
        this.uniforms.uTexture.value = this.currentItem.texture

        // scale plane to image ratio (so image isn't stretched)
        this.plane.scale.copy(this.scale)

        // reset mixValue
        this.uniforms.uMixValue.value = 0.0

        // interpolate uMixValue upto 1.0 (between two images)
        TweenLite.to(this.uniforms.uMixValue, 0.35, {
            value: 1.0,
            ease: Power1.easeOut
        });
    }
}