class GlitchDisplaceTransitionEffect extends EffectShell {
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

            varying vec2 vUv;

            // based on Matt DesLauriers Glitch Displace
            // https://github.com/gl-transitions/gl-transitions/blob/master/transitions/GlitchDisplace.glsl
            
            highp float random(vec2 co) {
                highp float a = 12.9898;
                highp float b = 78.233;
                highp float c = 43758.5453;
                highp float dt= dot(co.xy ,vec2(a,b));
                highp float sn= mod(dt,3.14);
                return fract(sin(sn) * c);
            }

            float voronoi( in vec2 x ) {
                vec2 p = floor( x );
                vec2 f = fract( x );
                float res = 8.0;
                for( float j=-1.; j<=1.; j++ )
                for( float i=-1.; i<=1.; i++ ) {
                    vec2  b = vec2( i, j );
                    vec2  r = b - f + random( p + b );
                    float d = dot( r, r );
                    res = min( res, d );
                }
                return sqrt( res );
            }

            vec2 displace(vec4 tex, vec2 texCoord, float dotDepth, float textureDepth, float strength) {
                float b = voronoi(.003 * texCoord + 2.0);
                float g = voronoi(0.2 * texCoord);
                float r = voronoi(texCoord - 1.0);
                vec4 dt = tex * 1.0;
                vec4 dis = dt * dotDepth + 1.0 - tex * textureDepth;

                dis.x = dis.x - 1.0 + textureDepth*dotDepth;
                dis.y = dis.y - 1.0 + textureDepth*dotDepth;
                dis.x *= strength;
                dis.y *= strength;
                vec2 res_uv = texCoord ;
                res_uv.x = res_uv.x + dis.x - 0.0;
                res_uv.y = res_uv.y + dis.y;
                return res_uv;
            }

            float ease1(float t) {
            return t == 0.0 || t == 1.0
                ? t
                : t < 0.5
                ? +0.5 * pow(2.0, (20.0 * t) - 10.0)
                : -0.5 * pow(2.0, 10.0 - (t * 20.0)) + 1.0;
            }

            float ease2(float t) {
            return t == 1.0 ? t : 1.0 - pow(2.0, -10.0 * t);
            }

            vec3 transition(vec2 uv) {
                float strength = 4.0;
                vec2 p = uv.xy / vec2(strength).xy;

                vec4 color1 = texture2D(uPreviousTexture, uv);
                vec4 color2 = texture2D(uTexture, uv);

                vec2 disp = displace(color1, p, 0.33, 0.7, 1.0-ease1(uMixValue));
                vec2 disp2 = displace(color2, p, 0.33, 0.5, ease2(uMixValue));

                vec4 dColor1 = texture2D(uPreviousTexture, disp);
                vec4 dColor2 = texture2D(uTexture, disp2);

                float val = ease1(uMixValue);

                vec3 gray = vec3(dot(min(dColor2, dColor1).rgb, vec3(0.299, 0.587, 0.114)));

                dColor2 = vec4(gray, 1.0);
                dColor2 *= 2.0;

                color1 = mix(color1, dColor2, smoothstep(0.0, 0.5, uMixValue));
                color2 = mix(color2, dColor1, smoothstep(1.0, 0.5, uMixValue));

                return mix(color1.rgb, color2.rgb, val);
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
        TweenLite.to(this.uniforms.uMixValue, 0.5, {
            value: 1.0,
            ease: Power1.easeOut
        });
    }
}