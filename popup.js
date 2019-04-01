document.body.onload = function() {
  chrome.storage.sync.get(["dataencr","enablencr"], function(items) {
    if (!chrome.runtime.error) {
      console.log(items);
      try {
          if(items.dataencr){
            document.getElementById("text").value = items.dataencr;
          }else{
            document.getElementById("text").value = "Change it!!!"
          }
          if(items.enablencr){
            document.enablencrform.enablencr.value=items.enablencr;
          }else{
            document.enablencrform.enablencr.value="off";
          }
          global_data= items.dataencr;

      } catch (e) {
        console.log(e)
      }

    }
  });
}

document.getElementById("set").onclick = function() {
  var d = document.getElementById("text").value;
  var radios = document.querySelectorAll('input[type="radio"]:checked');
  var value = radios.length>0? radios[0].value: null

  chrome.storage.sync.set({ "dataencr" : d, 'enablencr': value}, function() {
    try {
        document.getElementById("text").value = items.dataencr;
        document.enablencrform.enablencr.value = value;
        global_data = items.dataencr;
        if(value=='on'){
          $('._2nmDZ').animate({scrollTop:document.getElementsByClassName('_2nmDZ')[0].scrollHeight}, 100);
        }
    } catch (e) {

      console.log(e)
    }
    if (chrome.runtime.error) {
      console.log("Runtime error.");
    }
  });
  window.close();
}
