const Casque = require("../casque/Casque");
const FileSystemUtils = require("jukebox-js-libs/utils/FileSystemUtils");
const Swal = require("sweetalert2");


/**
 * Représente un contenu
 */
class ContenuModel {

    constructor(data){
        this.uid=data.uid;
        this.fileUid=data.fileUid;
        this.contenuUid=data.contenuUid;
        this.name=data.name;
        this.serverFile=data.serverFile;
        this.localFile=data.localFile;

        this.serverThumb=data.serverThumb;
        this.localThumb=data.localThumb;

        this.serverThumbNoResize=data.serverThumbNoResize;
        this.localThumbNoResize=data.localThumbNoResize;

        this.isCopied=Casque.isContenuCopied(this);
        /**
         * Url absolue du fichier à jouer dans le système de fichiers
         * @type {string}
         */
        this.localFileAbsolute=machine.appStoragePath+"/"+data.localFile;
        /**
         * Url absolue de la vignette dans le système de fichiers
         * @type {string}
         */
        this.localThumbAbsolute=machine.appStoragePath+"/"+data.localThumb;
        this.localThumbNoResizeAbsolute=machine.appStoragePath+"/"+data.localThumbNoResize;
        /**
         *
         * @type {null}
         */
        this.$copied=null;

    }

    /**
     * Renvoie l'élément DOM de ce contenu
     * @return {*|jQuery|HTMLElement}
     */
    $display(){
        let me=this;
        let $template=window.ui.$template("jukebox/contenu/contenu.html");
        $template.data("model",me);
        $template.find(".js-title").text(this.name);
        $template.find("img.card-img-top").attr("src",this.localThumbAbsolute);
        $template.find("div.card-img-top").css("background-image","url('"+FileSystemUtils.base64_encode(this.localThumbNoResizeAbsolute)+"')");
        $template.on("click",function(e){
           Casque.setContenuSelecteds(me);
        });
        this.$copied=$template.find("[casque-copied]");
        if(this.isCopied){
            this.$copied.addClass("copied");
        }else{
            this.$copied.removeClass("copied");
        }
        this.$copied.on("click",function(e){
            e.preventDefault();
            e.stopPropagation();
            //$(this).toggleClass("copied");
            me.setIsCopied(!me.isCopied);
        });

        //me.setIsCopied(Casque.isContenuCopied(me));




        return $template;



    }

    setIsCopied(copied=false){


        Swal.fire({
                title: "Êtes vous sur?",
                text: " Modifier les expériences sur les casques ?",
                type: "warning",
                showCancelButton: true,
                confirmButtonColor: "#3085d6",
                cancelButtonColor: "#d33",
                confirmButtonText: "Oui",
                cancelButtonText: "Non"
            })
            .then(validPlay => {

                if (validPlay.value) {


                    this.isCopied = copied;
                    if (this.isCopied) {
                        this.$copied.addClass("copied");
                    } else {
                        this.$copied.removeClass("copied");
                    }
                    let files = {};
                    $(".contenu-card").each(function () {
                        if ($(this).find(".copied").length > 0) {
                            /**
                             *
                             * @type {ContenuModel}
                             */
                            let contenu = $(this).data("model");
                            files[contenu.localFile] = 1;
                        }
                    });
                    Casque.setFilesOnCasques(files);
                }

            });




    }

}
module.exports = ContenuModel;