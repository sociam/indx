#Batch Webfont How-To and FAQ

###This guide is not the only way to incorporate the Batch webfont into your work. I am far from classing myself as a developer. It is just a guide to help you understand more how the web-font is constructed and how you could implement it. 
####If you get stuck at all, or require further details the quickest way to contact me is via my [twitter](http://twitter.com/sdmix).

#####Font Face Setup

First up, let's get the CSS for getting the Batch web-font into your project:
      
      @font-face{
        font-family:Batch;
        src:url('assets/batch.eot');
        src:url('assets/batch.eot?#iefix') format('embedded-opentype'),
          url('assets/batch.woff') format('woff'),
          url('assets/batch.ttf') format('truetype'),
          url('assets/batch.svg#batchregular') format('svg');
        font-weight:normal;
        font-style:normal;
      }
    
In this example, the font files are located in the _root/assets/_  folder, if this isn't where you plan on storing the files, just change these values.
Once you've got this in your CSS, you're set up and ready to go.


#####CSS Setup

The Batch web-font is designed and built to be give you pixel perfect icons at the size you declare within your CSS. So using the following code: 
      
      .batch {
        font-family:"Batch"; /*or whatever you've decalred your font name as*/
        font-size:16px;
        line-height:1;
        display:inline-block;
      }

will give you the icon at 16px. This is handy for when you're working from your designs.


#####Pulling the icons

All the icons in the Batch web-font are within the Private Unicode character range. This means that if for any reason the font file fails to load, you will either see nothing or a blank square depending on your system setup.
This also stops screen readers from reading out your icon's as letters. Something that is useful for accessability.
The easiest way to quickly test to make sure your code is working and the font is loading correctly is to place the following into your markup (based on the above code example):

    <div class="batch">
      &#xf000; &#xf001; &#xf002; &#xf003; &#xf004;
    </div>
  
Loading the page should show you some lovely icons at 16px. Nice.
If it doesn't check your developer tools to make sure the fonts are loading in correctly. If there is an issue, you might have a corrupt font file for the browser you are using.


#####Where to from here

You can use the example above as the basic starting point. 
There are many ways you can implement the font into your work, the above was just to show you the basic way.

My personal favourite would be using the following markup:

    <a href="#"><i class="batch" data-icon="&#xF000;"></i> Join the Conversation</a>
    
With the above code plus the following extra line in your CSS:

    .batch:before {
        content:attr(data-icon);
    }
    
You can then also add sizing elements to alter the size of the icons produced:

    .batch--large { font-size:32px; }
    .batch--huge { font-size:64px; }
    .batch--natural { font-size:inherit; }
    
Pretty cool right!

####Further questions or ideas?

Hit me up on [Twitter](https://twitter.com/intent/tweet?text=@sdmix Hey dude! I've got a question about the Batch web-font......) with any questions you'd like to see answered here. I live in the UK, so apologies if the time difference means I can't get back to you straight away but I'll be as quick as I can in getting back to you.







