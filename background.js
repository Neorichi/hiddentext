global_data = ""
global_enablencr = "";


function replaceAll(str, find, replace) {
    return str.replace(new RegExp(find, 'g'), replace);
}

function convert(input) {
  var string = "";
  for (i = 0; i < input.length; i++) {
    var e = input[i].charCodeAt(0);
    var s = "";
    do {
      var a = e % 2;
      e = (e - a) / 2;
      s = a + s;
    } while (e != 0);
    while (s.length < 8) {
      s = "0" + s;
    }
    s = replaceAll(s,0,"&#8203;");
    s = replaceAll(s,1,"&#8204;");
    string += s;
  }
  return string;

}

function bin2txt(binary)
{
  var string = "";
  if(binary.length%8 != 0){
	return -1;
  }
  for(i=0; i<binary.length/8; i++){
	sub = binary.substr(i*8, 8);
	num = 0;
	for(j=0; j<sub.length; j++){
	  if(sub.charAt(j) == '0'){
	  }
	  else{
		num += Math.pow(2, 7-j);
	  }
	}
	string += String.fromCharCode(num);
  }
  return string;
}
function escapeRegExp(string){
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function revertconvert(encode) {

  const regex = /%E2%+\d+%8[A-Z]/gm;

  let m;
  var text = ""
  while ((m = regex.exec(encode)) !== null) {
    if (m.index === regex.lastIndex) {
        regex.lastIndex++;
    }

    m.forEach((match, groupIndex) => {
        text += match
    });
  }
  text = replaceAll(text,"%E2%80%8B",0);
  text = replaceAll(text,"%E2%80%8C",1);
  text = bin2txt(text)
  return text;


}

function escapeRegExp(string){
  string = string.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}



function printrevert(selectable){
    $(selectable).each(function() {
        var encode_ = encodeURIComponent($(this).html());
        //Remove img
        encode_ = encode_.replace(/<img[^>]*>/g,"");
        if(encode_.search("%E2%80")>=0 && $(this).html()!="" && $(this).children(".reverse_msg").length==0){
          try {
            $(this).append("<strong id='reverse_msg' class='reverse_msg' style='overflow:hidden;display: block;height: 18px;'>-"+escapeRegExp(revertconvert(encode_))+"-</strong>");

          } catch (e) {

          }

        }
    });
}

function setdata(text,userto,classname){
  var output = document.getElementsByClassName(classname)
  var encode_ = encodeURIComponent(output[0].innerHTML);
  if(encode_.search("%E2%80")<0){
    hidemsg = convert(text + " to: " + userto);

    var strFirst = output[0].innerHTML.substring(0,1);
    var strLast = output[0].innerHTML.substring(1,);
    output[0].innerHTML = strFirst + hidemsg + strLast;


  }
}



function setdata_w(text,userto) {
    var evt = new Event('input', {
        bubbles: true
    });

    try {
      var output = document.querySelector("div._2S1VP");
      var encode_ = encodeURIComponent(output.innerHTML);
      if(encode_.search("%E2%80")<0){




        hidemsg = convert(text + " to: " + userto);


        var strFirst = output.innerHTML.substring(0,1);
        var strLast = output.innerHTML.substring(1,);
        output.innerHTML = strFirst + hidemsg + strLast;

        output.dispatchEvent(evt);
        document.querySelector(".icon-send").click();
      }

    } catch (e) {
      console.log(e);
    }

}


function clearmsg(classname){
  try {
    var output = document.getElementsByClassName(classname)
    var encode = encodeURIComponent(output[0].innerHTML);
    encode = replaceAll(encode,"%E2%80%8B","");
    encode = replaceAll(encode,"%E2%80%8C","");
    return encode;
  } catch (e) {
    console.log(e)
  }

}


function chromevalue(){
  chrome.storage.sync.get(["dataencr","enablencr"], function(items) {
    if (!chrome.runtime.error) {
      global_data= items.dataencr;
      global_enablencr = items.enablencr;
    }
  });

}

$(function() {

  console.log("Hello")
  //Whatsapp
  if(document.domain=="web.whatsapp.com"){
  $('body').click(function(e) {
      document.getElementsByClassName('_2S1VP')[0].onkeydown = function(e){
        if(global_enablencr=='on'){
           if(e.keyCode == 13){
             if(clearmsg('_2S1VP').length!=0){
               try {
                 var userto = document.getElementsByClassName('_3XrHh');
                 setdata_w(global_data,userto[0].outerText)
               } catch (e) {
                 var userto = "None"
                 setdata_w(global_data,userto)
               }


               $('._2nmDZ').animate({scrollTop:document.getElementsByClassName('_2nmDZ')[0].scrollHeight}, 100);
             }
           }
         }
      };

  })



  var t_ = setInterval(function()  {
    chromevalue();
    if(global_enablencr=='on'){
        printrevert(".invisible-space");
    }else{
      $(".reverse_msg").remove();
    }

  }, 500);



  }else{
  //Telegram
  document.getElementsByClassName('composer_rich_textarea')[0].onkeydown = function(e){
       if(e.keyCode == 13){
         if(global_enablencr=='on'){
           if(clearmsg('composer_rich_textarea').length!=0){
             var userto = document.getElementsByClassName('tg_head_peer_title');
             setdata(global_data,userto[0].innerHTML,"composer_rich_textarea");
           }
         }
       }

  };


    var t_ = setInterval(function()  {
      chromevalue();
      if(global_enablencr=='on'){
        printrevert(".im_message_text");
      }else{
        $(".reverse_msg").remove();
      }

    }, 500);
  }

})
