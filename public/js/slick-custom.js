

(function ($) {
    // USE STRICT
    "use strict";

        /*==================================================================
        [ Slick1 ]*/
        $('.wrap-slick1').each(function(){
            var wrapSlick1 = $(this);
            var slick1 = $(this).find('.slick1');


            var itemSlick1 = $(slick1).find('.item-slick1');
            var layerSlick1 = $(slick1).find('.layer-slick1');
            var actionSlick1 = [];
            

            $(slick1).on('init', function(){
                var layerCurrentItem = $(itemSlick1[0]).find('.layer-slick1');

                for(var i=0; i<actionSlick1.length; i++) {
                    clearTimeout(actionSlick1[i]);
                }

                $(layerSlick1).each(function(){
                    $(this).removeClass($(this).data('appear') + ' visible-true');
                });

                for(var i=0; i<layerCurrentItem.length; i++) {
                    actionSlick1[i] = setTimeout(function(index) {
                        $(layerCurrentItem[index]).addClass($(layerCurrentItem[index]).data('appear') + ' visible-true');
                    },$(layerCurrentItem[i]).data('delay'),i); 
                }        
            });


            var showDot = false;
            if($(wrapSlick1).find('.wrap-slick1-dots').length > 0) {
                showDot = true;
            }

            $(slick1).slick({
                pauseOnFocus: false,
                pauseOnHover: false,
                slidesToShow: 1,
                slidesToScroll: 1,
                fade: true,
                speed: 1000,
                infinite: true,
                autoplay: true,
                autoplaySpeed: 6000,
                arrows: true,
                appendArrows: $(wrapSlick1),
                prevArrow:'<button class="arrow-slick1 prev-slick1"><i class="zmdi zmdi-caret-left"></i></button>',
                nextArrow:'<button class="arrow-slick1 next-slick1"><i class="zmdi zmdi-caret-right"></i></button>',
                dots: showDot,
                appendDots: $(wrapSlick1).find('.wrap-slick1-dots'),
                dotsClass:'slick1-dots',
                customPaging: function(slick, index) {
                    var linkThumb = $(slick.$slides[index]).data('thumb');
                    var caption = $(slick.$slides[index]).data('caption');
                    return  '<img src="' + linkThumb + '">' +
                            '<span class="caption-dots-slick1">' + caption + '</span>';
                },
            });

            $(slick1).on('afterChange', function(event, slick, currentSlide){ 

                var layerCurrentItem = $(itemSlick1[currentSlide]).find('.layer-slick1');

                for(var i=0; i<actionSlick1.length; i++) {
                    clearTimeout(actionSlick1[i]);
                }

                $(layerSlick1).each(function(){
                    $(this).removeClass($(this).data('appear') + ' visible-true');
                });

                for(var i=0; i<layerCurrentItem.length; i++) {
                    actionSlick1[i] = setTimeout(function(index) {
                        $(layerCurrentItem[index]).addClass($(layerCurrentItem[index]).data('appear') + ' visible-true');
                    },$(layerCurrentItem[i]).data('delay'),i); 
                }
                         
            });

        });

        /*==================================================================
        [ Slick1 mobile — homepage hero, phones only ]
        Independent instance from Slick1 above: portrait photos instead of
        background-image banners, so the model isn't cropped out on a
        narrow screen. Simpler than Slick1 (no staggered text layers) since
        the CTA button is just plain markup inside each slide. */
        $('.wrap-slick-mobile-hero').each(function(){
            var wrap = $(this);
            $(wrap).find('.slick-mobile-hero').slick({
                slidesToShow: 1,
                slidesToScroll: 1,
                fade: true,
                speed: 800,
                infinite: true,
                autoplay: true,
                autoplaySpeed: 4500,
                pauseOnFocus: false,
                pauseOnHover: false,
                arrows: false,
                dots: true,
                appendDots: wrap,
                dotsClass: 'slick-mobile-hero-dots',
            });
        });

        // Both hero sliders above can be initialized while CSS has them
        // display:none (whichever one doesn't match the current
        // breakpoint), which makes slick measure a 0px-wide container. If
        // someone resizes an open browser across the 767px breakpoint
        // instead of loading fresh on a phone, recalculate positions once
        // the now-visible slider actually has real width to measure.
        var heroResizeTimer;
        $(window).on('resize', function(){
            clearTimeout(heroResizeTimer);
            heroResizeTimer = setTimeout(function(){
                var $slick1 = $('.wrap-slick1 .slick1');
                var $slickMobileHero = $('.wrap-slick-mobile-hero .slick-mobile-hero');
                if ($slick1.hasClass('slick-initialized')) $slick1.slick('setPosition');
                if ($slickMobileHero.hasClass('slick-initialized')) $slickMobileHero.slick('setPosition');
            }, 200);
        });

        /*==================================================================
        [ Slick2 ]*/
        $('.wrap-slick2').each(function(){
            $(this).find('.slick2').slick({
              slidesToShow: 4,
              slidesToScroll: 4,
              infinite: false,
              autoplay: false,
              autoplaySpeed: 6000,
              arrows: true,
              appendArrows: $(this),
              prevArrow:'<button class="arrow-slick2 prev-slick2"><i class="fa fa-angle-left" aria-hidden="true"></i></button>',
              nextArrow:'<button class="arrow-slick2 next-slick2"><i class="fa fa-angle-right" aria-hidden="true"></i></button>',  
              responsive: [
                {
                  breakpoint: 1200,
                  settings: {
                    slidesToShow: 4,
                    slidesToScroll: 4
                  }
                },
                {
                  breakpoint: 992,
                  settings: {
                    slidesToShow: 3,
                    slidesToScroll: 3
                  }
                },
                {
                  breakpoint: 768,
                  settings: {
                    slidesToShow: 2,
                    slidesToScroll: 2
                  }
                },
                {
                  breakpoint: 576,
                  settings: {
                    slidesToShow: 1,
                    slidesToScroll: 1
                  }
                }
              ]    
            });
          });


        $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
          var nameTab = $(e.target).attr('href'); 
          $(nameTab).find('.slick2').slick('reinit');          
        });      
        
        /*==================================================================
        [ Slick3 ]*/
        $('.wrap-slick3').each(function(){
            var $wrap = $(this);
            var $track = $wrap.find('.slick3');
            var $dotsBox = $wrap.find('.wrap-slick3-dots');

            var $thumbs = $('<div class="slick3-thumbs"></div>');
            $track.find('.item-slick3').each(function(){
                var portrait = $(this).data('thumb');
                $thumbs.append('<div class="slick3-thumb-item"><img src="' + portrait + '" alt=""></div>');
            });
            $dotsBox.empty().append($thumbs);

            $track.slick({
                slidesToShow: 1,
                slidesToScroll: 1,
                fade: false,
                infinite: true,
                autoplay: false,
                autoplaySpeed: 6000,
                asNavFor: $thumbs,

                arrows: true,
                appendArrows: $wrap.find('.wrap-slick3-arrows'),
                prevArrow:'<button class="arrow-slick3 prev-slick3"><i class="fa fa-angle-left" aria-hidden="true"></i></button>',
                nextArrow:'<button class="arrow-slick3 next-slick3"><i class="fa fa-angle-right" aria-hidden="true"></i></button>',

                dots: false,
            });

            $thumbs.slick({
                slidesToShow: Math.min(3, $thumbs.children().length),
                slidesToScroll: 1,
                centerMode: true,
                centerPadding: '0px',
                fade: false,
                infinite: true,
                autoplay: false,
                asNavFor: $track,
                focusOnSelect: true,

                arrows: true,
                prevArrow: '<button type="button" class="slick3-thumb-arrow slick3-thumb-prev" aria-label="Previous photos"><i class="fa fa-angle-left" aria-hidden="true"></i></button>',
                nextArrow: '<button type="button" class="slick3-thumb-arrow slick3-thumb-next" aria-label="More photos"><i class="fa fa-angle-right" aria-hidden="true"></i></button>',
            });
        });
            
                

})(jQuery);